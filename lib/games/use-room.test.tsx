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
      bot: false,
    },
    token: issued,
  });

  const server = {
    holdReads: false,
    /** 켜면 요청이 서버에 닿지 못한다(서버 꺼짐) */
    down: false,
    /** 켜면 방이 사라진다(404) */
    gone: false,
    reads: 0,
    release() {
      held.splice(0).forEach((deliver) => deliver());
    },
    create() {
      tokens.black = "black-token";
      return ok(tokens.black, tokens.black);
    },
    join(token?: string): RoomResult<GomokuState> {
      if (seatOf(token)) return ok(token, token ?? null);
      if (tokens.white) return { ok: false, error: "이미 두 명이 들어간 방이에요", status: 409 };
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
    if (server.down) return Promise.reject(new TypeError("Failed to fetch"));
    const url = new URL(input);
    const code = url.pathname.split("/")[5];
    let result: RoomResult<GomokuState>;
    if (init?.method === "POST") {
      const body: RoomAction = JSON.parse(String(init.body));
      posts.push(body);
      if (!code) result = server.create();
      else result = body.type === "join" ? server.join(body.token) : server.move(body.token, body.index ?? -1);
    } else {
      server.reads += 1;
      result = server.gone ? { ok: false, error: "없는 초대 코드예요", status: 404 } : ok(url.searchParams.get("token"));
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
    localStorage.clear();
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

  it("판이 그대로면 폴링이 와도 같은 화면 객체를 유지하고(매초 판 전체를 다시 그리지 않게), 바뀌면 새로 받는다", async () => {
    const { server } = fakeServer();
    const { result } = renderRoom();
    act(() => result.current.create());
    await until(() => result.current.view !== null);
    const before = result.current.view;

    await tickPoll();
    await settle();
    expect(result.current.view).toBe(before);

    server.join();
    await tickPoll();
    await until(() => result.current.view?.joined.white === true);
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

  it("게임 서버에 연결되지 않으면 한국어로 알리고 판을 막았다가, 다시 연결되면 저절로 이어진다", async () => {
    const { server } = fakeServer();
    const { result } = renderRoom();
    act(() => result.current.create());
    await until(() => result.current.view !== null);

    server.down = true;
    await tickPoll();
    await until(() => result.current.reconnecting);
    expect(result.current.error).toContain("게임 서버에 연결할 수 없어요");

    server.down = false;
    await act(() => vi.advanceTimersByTimeAsync(2000)); // 한 번 실패한 뒤에는 2초 뒤에 다시 받는다
    await until(() => !result.current.reconnecting);
    expect(result.current.error).toBe("");
  });

  it("대국 중에 방이 사라지면 폴링을 멈추고 사라졌다고 알린다", async () => {
    const { server } = fakeServer();
    const { result } = renderRoom();
    act(() => result.current.create());
    await until(() => result.current.view !== null);

    server.gone = true;
    await tickPoll();
    await until(() => result.current.gone);
    const reads = server.reads;

    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(server.reads).toBe(reads);
    expect(result.current.error).toBe("");
  });

  it("클립보드가 없는 브라우저(HTTPS 아닌 주소 등)에서 초대 링크 복사를 눌러도 예외 대신 복사 실패를 알린다", async () => {
    const { server } = fakeServer();
    const { hook } = await joinAsWhite(server);
    // jsdom에는 navigator.clipboard가 없다 — 그런 브라우저와 같은 조건
    expect(navigator.clipboard).toBeUndefined();

    expect(() => act(() => hook.result.current.copyInvite())).not.toThrow();
    await until(() => hook.result.current.error.startsWith("복사하지 못했어요"));
  });

  it("방 만들기 응답이 오기 전에 게임 페이지를 떠났으면(로비로 뒤로 가기) 그 페이지 주소에 ?code를 붙이지 않는다", async () => {
    fakeServer();
    const { result } = renderRoom();
    // 방 만들기를 누르고 응답이 오기 전에 로비(/)로 나간 상태
    window.history.replaceState(null, "", "/");
    act(() => result.current.create());
    await until(() => result.current.view !== null);

    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
  });

  it("두 명이 이미 들어간 방이면 관전으로 볼 수 있다", async () => {
    const { server } = fakeServer();
    server.create();
    server.join();
    const { result } = renderRoom();

    act(() => result.current.join(CODE));
    await until(() => result.current.spectateCode === CODE);
    act(() => result.current.watch());
    await until(() => result.current.view?.code === CODE);
    expect(result.current.view?.you).toBeNull();
  });
});
