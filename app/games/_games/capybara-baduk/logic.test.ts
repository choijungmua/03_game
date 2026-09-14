import { describe, expect, it } from "vitest";

import { createGame, type GoState, KOMI, passTurn, playMove, resign, scoreGame, type Stone } from "./logic";

// 9줄 판에서 (x, y) 자리 = y * 9 + x
function withStones(black: number[], white: number[], turn: Stone = "black"): GoState {
  const state = createGame();
  for (const i of black) state.board[i] = "black";
  for (const i of white) state.board[i] = "white";
  return { ...state, turn };
}

function play(state: GoState, index: number, stone: Stone) {
  const result = playMove(state, index, stone);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("playMove", () => {
  it("흑부터 번갈아 둔다", () => {
    const next = play(createGame(), 40, "black");
    expect(next.board[40]).toBe("black");
    expect(next.turn).toBe("white");
    expect(playMove(next, 41, "black")).toEqual({ ok: false, error: "상대 차례예요" });
    expect(playMove(next, 40, "white")).toEqual({ ok: false, error: "이미 돌이 있어요" });
  });

  it("활로가 없어진 상대 돌을 따낸다", () => {
    const next = play(withStones([1], [0]), 9, "black");
    expect(next.board[0]).toBeNull();
    expect(next.captures.black).toBe(1);
  });

  it("자충수는 둘 수 없다", () => {
    expect(playMove(withStones([], [1, 9]), 0, "black").ok).toBe(false);
  });

  it("패는 바로 되따낼 수 없고, 한 수 쉬고 나면 된다", () => {
    const start = withStones([1, 9, 19], [2, 12, 20, 10]);
    const afterCapture = play(start, 11, "black");
    expect(afterCapture.board[10]).toBeNull();
    expect(afterCapture.koPoint).toBe(10);
    expect(playMove(afterCapture, 10, "white").ok).toBe(false);

    const later = play(play(afterCapture, 80, "white"), 79, "black");
    expect(play(later, 10, "white").board[11]).toBeNull();
  });
});

describe("대국 종료", () => {
  it("두 번 연속 패스하면 계가해서 끝난다", () => {
    const once = passTurn(createGame(), "black");
    if (!once.ok) throw new Error(once.error);
    expect(once.state.winner).toBeNull();

    const twice = passTurn(once.state, "white");
    if (!twice.ok) throw new Error(twice.error);
    expect(twice.state).toMatchObject({ winner: "white", endReason: "pass", finalScore: { black: 0, white: KOMI } });
  });

  it("기권하면 상대가 이긴다", () => {
    const result = resign(createGame(), "black");
    expect(result.ok && result.state.winner).toBe("white");
  });

  it("한 색으로만 둘러싼 빈 곳은 그 색 집이다", () => {
    const column = Array.from({ length: 9 }, (_, y) => y * 9 + 4);
    expect(scoreGame(withStones(column, []))).toEqual({ black: 81, white: KOMI });
  });
});
