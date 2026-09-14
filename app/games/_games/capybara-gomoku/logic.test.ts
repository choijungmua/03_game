import { describe, expect, it } from "vitest";

import { createGame, type GomokuState, playMove, resign, timeOut } from "./logic";
import type { Stone } from "@/lib/games/rooms";

// 15줄 판에서 (x, y) 자리 = y * 15 + x
const at = (x: number, y: number) => y * 15 + x;

function withStones(black: number[], white: number[], turn: Stone = "black"): GomokuState {
  const state = createGame();
  for (const i of black) state.board[i] = "black";
  for (const i of white) state.board[i] = "white";
  return { ...state, turn };
}

function play(state: GomokuState, index: number, stone: Stone) {
  const result = playMove(state, index, stone);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("playMove", () => {
  it("흑부터 번갈아 두고, 빈 자리에만 둔다", () => {
    const next = play(createGame(), at(7, 7), "black");
    expect(next).toMatchObject({ turn: "white", lastMove: at(7, 7), endReason: null });
    expect(playMove(next, at(0, 0), "black")).toEqual({ ok: false, error: "상대 차례예요" });
    expect(playMove(next, at(7, 7), "white")).toEqual({ ok: false, error: "이미 돌이 있어요" });
  });

  it("가로 다섯 개를 이으면 이긴다 (가운데를 채워도)", () => {
    const state = withStones([at(3, 5), at(4, 5), at(6, 5), at(7, 5)], []);
    const next = play(state, at(5, 5), "black");
    expect(next).toMatchObject({ winner: "black", endReason: "five" });
    expect(next.winLine.toSorted((a, b) => a - b)).toEqual([at(3, 5), at(4, 5), at(5, 5), at(6, 5), at(7, 5)]);
  });

  it("두 대각선 방향 모두 판정한다", () => {
    const down = withStones([], [at(0, 0), at(1, 1), at(2, 2), at(3, 3)], "white");
    expect(play(down, at(4, 4), "white").winner).toBe("white");

    const up = withStones([at(10, 4), at(11, 3), at(12, 2), at(13, 1)], []);
    expect(play(up, at(14, 0), "black").winner).toBe("black");
  });

  it("네 개는 아직 아니고, 판 끝을 넘어 이어 세지 않는다", () => {
    expect(play(withStones([at(0, 0), at(1, 0), at(2, 0)], []), at(3, 0), "black").endReason).toBeNull();
    // 한 줄 끝(14,0)과 다음 줄 처음(0,1)은 1차원으론 붙어 있지만 이어진 게 아니다
    expect(play(withStones([at(12, 0), at(13, 0), at(0, 1), at(1, 1)], []), at(14, 0), "black").endReason).toBeNull();
  });

  it("여섯 개 이상도 이긴다 (자유 오목)", () => {
    const state = withStones([at(0, 9), at(1, 9), at(2, 9), at(4, 9), at(5, 9)], []);
    expect(play(state, at(3, 9), "black").winLine).toHaveLength(6);
  });

  it("끝난 판에는 더 둘 수 없다", () => {
    const over = play(withStones([at(0, 0), at(1, 0), at(2, 0), at(3, 0)], []), at(4, 0), "black");
    expect(playMove(over, at(9, 9), "white").ok).toBe(false);
  });

  it("판이 가득 차면 무승부", () => {
    const state = createGame(1);
    expect(play(state, 0, "black")).toMatchObject({ winner: null, endReason: "draw" });
  });
});

describe("resign", () => {
  it("기권하면 상대가 이긴다", () => {
    const result = resign(createGame(), "black");
    expect(result.ok && result.state).toMatchObject({ winner: "white", endReason: "resign" });
  });

  it("시간을 넘기면 상대가 이긴다", () => {
    expect(timeOut(createGame(), "white")).toMatchObject({ winner: "black", endReason: "timeout" });
  });
});
