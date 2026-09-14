import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGame, type GomokuState, playMove } from "@/app/games/_games/capybara-gomoku/logic";
import type { GomokuAction } from "@/app/games/_games/capybara-gomoku/rooms";

import type { RoomAction, RoomResult, Stone } from "./rooms";
import { useRoom } from "./use-room";

const SLUG = "capybara-gomoku";
const CODE = "ABCDEF";

// 백엔드 방 API(/api/games/<slug>/rooms[/<code>])를 흉내 내는 가짜 fetch. 방 하나에 오목 규칙만 쓴다.
// holdReads를 켜면 GET 응답을 요청 시점 상태로 만들어 두고, release()할 때 늦게 도착시킨다
function fakeServer() {
  let state = createGame();
  let version = 1;
  const tokens: Record<Stone, string | null> = { black: null, white: null };
  const held: Array<() => void> = [];
  const posts: RoomAction[] = [];

  const seatOf = (token?: string | null): Stone | null =>
    token && tokens.black === token ? "black" : token && tokens.white === token ? "white" : null;
  const ok = (token?: string | null, issued: string | null = null): RoomResult<GomokuState> => ({
    ok: true,
    view: {
      code: CODE,
      state,
      joined: { black: tokens.black !== null, white: tokens.white !== null },
      you: seatOf(token),
      now: Date.now(),
      version,
      emote: null,
    },
    token: issued,
  });

  const server = {
    holdReads: false,
    release() {
      held.splice(0).forEach((deliver) => deliver());
    },
    create() {
      tokens.black = "black-token";
      return ok(tokens.black, tokens.black);
    },
    join(token?: string) {
      if (seatOf(token)) return ok(token, token ?? null);
      tokens.white = "white-token";
      version += 1;
      return ok(tokens.white, tokens.white);
    },
    move(token: string | undefined, index: number): RoomResult<GomokuState> {
      const seat = seatOf(token);
      if (!seat) return { ok: false, error: "이 방의 대국자가 아니에요", status: 403 };
      const result = playMove(state, index, seat);
      if (!result.ok) return { ok: false, error: result.error, status: 409 };
      state = result.state;
      version += 1;
      return ok(token);
    },
  };

  vi.stubGlobal("fetch", (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const code = url.pathname.split("/")[5];
    let result: RoomResult<GomokuState>;
    if (init?.method === "POST") {
      const body: RoomAction = JSON.parse(String(init.body));
      posts.push(body);
      if (!code) result = server.create();
      else result = body.type === "join" ? server.join(body.token) : server.move(body.token, body.index ?? -1);
    } else {
      result = ok(url.searchParams.get("token"));
    }
    const response = { ok: result.ok, json: () => Promise.resolve(result) };
    if (init?.method !== "POST" && server.holdReads) {
      return new Promise((resolve) => held.push(() => resolve(response)));
    }
    return Promise.resolve(response);
  });

  return { server, posts };
}

function renderRoom() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useRoom<GomokuState, GomokuAction>(SLUG), { wrapper });
}

const tickPoll = () => act(() => vi.advanceTimersByTimeAsync(1000));
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

// setInterval을 가짜로 바꿔서 Testing Library의 waitFor(내부에서 setInterval로 재확인)는 못 쓴다 — 진짜 setTimeout으로 기다린다
async function until(check: () => boolean) {
  for (let i = 0; i < 50; i++) {
    if (check()) return;
    await settle();
  }
  throw new Error("기다린 상태가 되지 않았어요");
}

/** 흑은 서버에서 바로 방을 만들고, 훅(백)이 초대 코드로 들어온다 */
async function joinAsWhite(server: ReturnType<typeof fakeServer>["server"]) {
  const created = server.create();
  if (!created.ok || !created.token) throw new Error("방 생성 실패");
  const hook = renderRoom();
  act(() => hook.result.current.join(CODE));
  await until(() => hook.result.current.view?.you === "white");
  return { blackToken: created.token, hook };
}

describe("useRoom", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    window.history.replaceState(null, "", "/games/capybara-gomoku");
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("수를 둔 뒤에 늦게 도착한 옛날 폴링 응답이 판을 되돌리지 않는다", async () => {
    const { server } = fakeServer();
    const { result } = renderRoom();
    act(() => result.current.create());
    await until(() => result.current.view !== null);
    server.join();

    server.holdReads = true;
    await tickPoll(); // 폴링이 나갔지만(빈 판 상태로 응답이 만들어짐) 아직 도착하지 않음

    act(() => result.current.act("move", 112));
    await until(() => result.current.view?.state.board[112] === "black");

    await act(async () => server.release());
    await settle();
    expect(result.current.view?.state.board[112]).toBe("black");
  });

  it("화면이 늦어 상대 차례로 알고 있어도, 서버에서 이미 내 차례면 한 번 눌러서 둔다", async () => {
    const { server } = fakeServer();
    const { blackToken, hook } = await joinAsWhite(server);
    server.move(blackToken, 0);
    expect(hook.result.current.view?.state.turn).toBe("black");

    act(() => hook.result.current.act("move", 1));
    await until(() => hook.result.current.view?.state.board[1] === "white");
    expect(hook.result.current.error).toBe("");
  });

  it("정말 상대 차례면 서버에 수를 보내지 않고 에러도 띄우지 않는다", async () => {
    const { server, posts } = fakeServer();
    const { hook } = await joinAsWhite(server);

    act(() => hook.result.current.act("move", 1));
    await settle();
    await settle();
    expect(posts.filter((post) => post.type === "move")).toEqual([]);
    expect(hook.result.current.error).toBe("");
  });

  it("탭으로 돌아오면 폴링을 기다리지 않고 바로 새로 받는다", async () => {
    const { server } = fakeServer();
    const { blackToken, hook } = await joinAsWhite(server);
    server.move(blackToken, 0);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    });
    await until(() => hook.result.current.view?.state.turn === "white");
  });
});
