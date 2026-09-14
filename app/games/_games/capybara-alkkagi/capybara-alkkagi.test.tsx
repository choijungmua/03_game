import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RoomView } from "@/lib/games/rooms";
import type { useRoom } from "@/lib/games/use-room";

import { CapybaraAlkkagi } from "./capybara-alkkagi";
import { type AlkkagiState, createGame, MAX_SPEED, shoot } from "./logic";
import type { AlkkagiAction } from "./rooms";

type AlkkagiRoom = ReturnType<typeof useRoom<AlkkagiState, AlkkagiAction>>;

const holder = vi.hoisted(() => ({ room: null as AlkkagiRoom | null }));
vi.mock("@/lib/games/use-room", () => ({ useRoom: () => holder.room }));

const MY_PIECE = /^내 (대장 )?흰 카피바라$/;

// 흑(상대)이 맨 왼쪽 알을 곧게 쏘아 올려 백(나) 알을 맞힌다 → 다음은 내 차례
const start: AlkkagiState = { ...createGame(), turnStartedAt: Date.now() };
const shot = shoot(start, 0, { x: 0, y: -MAX_SPEED }, "black");
if (!shot.ok) throw new Error(shot.error);
const afterShot = shot.state;

function viewOf(state: AlkkagiState, version: number, emote: RoomView<AlkkagiState>["emote"] = null): RoomView<AlkkagiState> {
  return { code: "ABCDEF", state, joined: { black: true, white: true }, you: "white", now: Date.now(), version, emote, bot: false };
}

function roomWith(view: RoomView<AlkkagiState>): AlkkagiRoom {
  return {
    slug: "capybara-alkkagi",
    view,
    error: "",
    pending: false,
    reconnecting: false,
    gone: false,
    spectateCode: null,
    copied: false,
    clockOffset: 0,
    create: vi.fn(),
    join: vi.fn(),
    watch: vi.fn(),
    act: vi.fn(),
    sendEmote: vi.fn(),
    copyInvite: vi.fn(),
    leave: vi.fn(),
    setError: vi.fn(),
  };
}

let frames: FrameRequestCallback[] = [];

/** 쌓인 rAF를 now 시각으로 끝까지 돌린다. 브라우저처럼 콜백 안 에러는 밖으로 던지지 않고 그 프레임만 끊긴다 */
function runFrames(now: number) {
  act(() => {
    for (let round = 0; round < 100 && frames.length > 0; round++) {
      const queued = frames;
      frames = [];
      for (const callback of queued) {
        try {
          callback(now);
        } catch {}
      }
    }
  });
}

function show(view: RoomView<AlkkagiState>, rerender?: ReturnType<typeof render>["rerender"]) {
  holder.room = roomWith(view);
  if (rerender) rerender(<CapybaraAlkkagi />);
  else return render(<CapybaraAlkkagi />);
}

describe("CapybaraAlkkagi 판 잠김", () => {
  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", (media: string) => ({ matches: false, media, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "animate");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("상대 샷 애니메이션 도중 오류가 나도 내 차례에 알을 칠 수 있다", () => {
    const animate = vi.fn(() => {
      throw new Error("애니메이션 중 오류");
    });
    Object.defineProperty(HTMLElement.prototype, "animate", { value: animate, configurable: true });

    const rendered = show(viewOf(start, 1));
    show(viewOf(afterShot, 2), rendered?.rerender);
    runFrames(performance.now() + 60_000);

    // 알끼리 부딪혀 판 흔들기(오류)가 실제로 불렸는지
    expect(animate).toHaveBeenCalled();
    expect(afterShot.turn).toBe("white");
    const mine = screen.getAllByRole("button", { name: MY_PIECE });
    expect(mine.length).toBeGreaterThan(0);
    for (const piece of mine) expect(piece).toBeEnabled();
  });

  it("샷이 끝난 뒤 이모티콘이 와도 알을 칠 수 있다", () => {
    Object.defineProperty(HTMLElement.prototype, "animate", { value: vi.fn(), configurable: true });

    const rendered = show(viewOf(start, 1));
    show(viewOf(afterShot, 2), rendered?.rerender);
    runFrames(performance.now() + 60_000);
    show(viewOf(afterShot, 3, { seat: "black", id: 1, at: Date.now() }), rendered?.rerender);

    expect(screen.getByText("메롱~")).toBeInTheDocument();
    for (const piece of screen.getAllByRole("button", { name: MY_PIECE })) expect(piece).toBeEnabled();
  });
});
