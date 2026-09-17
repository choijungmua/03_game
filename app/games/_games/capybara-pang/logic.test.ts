import { describe, expect, it } from "vitest";

import { BOARD_SIZE, TILE_POINTS } from "./constants";
import {
  type Board,
  collapse,
  createBoard,
  findMove,
  findRuns,
  isValidSwap,
  planClear,
  scoreFor,
  shuffleBoard,
  type TileSpecial,
} from "./logic";

/** 글자 판으로 테스트 판을 만든다. 숫자 = 동물 종류, B = 0번 동물 폭탄, R = 무지개 */
function boardFrom(rows: string[]): Board {
  let id = 0;
  return rows.flatMap((row) =>
    [...row].map((char) => {
      id += 1;
      const special: TileSpecial = char === "B" ? "bomb" : char === "R" ? "rainbow" : "none";
      return { id, kind: special === "none" ? Number(char) : 0, special };
    }),
  );
}

// 줄이 하나도 없는 바탕 (0~6이 대각선으로 돈다)
const BASE = Array.from({ length: BOARD_SIZE }, (_, row) =>
  Array.from({ length: BOARD_SIZE }, (_, col) => String((row * 3 + col) % BOARD_SIZE)).join(""),
);

function withRow(row: number, text: string) {
  return BASE.map((line, i) => (i === row ? text : line));
}

describe("capybara-pang 로직", () => {
  it("새 판은 처음부터 터진 줄이 없고 둘 수 있는 수가 있다", () => {
    for (let i = 0; i < 20; i += 1) {
      const board = createBoard(Math.random, { next: 0 });
      expect(board).toHaveLength(BOARD_SIZE * BOARD_SIZE);
      expect(findRuns(board)).toEqual([]);
      expect(findMove(board)).not.toBeNull();
    }
  });

  it("같은 동물 3개 이상 가로·세로 줄을 찾는다", () => {
    expect(findRuns(boardFrom(BASE))).toEqual([]);
    expect(findRuns(boardFrom(withRow(0, "5552103")))).toEqual([[0, 1, 2]]);
  });

  it("바꿔서 줄이 생길 때만 유효한 수다. 무지개는 언제나 바꿀 수 있다", () => {
    const board = boardFrom(withRow(0, "5525103"));
    expect(isValidSwap(board, 2, 3)).toBe(true);
    expect(isValidSwap(board, 0, 7)).toBe(false);
    expect(isValidSwap(board, 0, 2)).toBe(false); // 붙어 있지 않음
    expect(isValidSwap(boardFrom(withRow(0, "R123456")), 0, 1)).toBe(true);
  });

  it("4개 줄은 폭탄, 5개 줄은 무지개를 옮긴 자리에 남긴다", () => {
    const four = boardFrom(withRow(0, "5555103"));
    const fourPlan = planClear(four, findRuns(four), [], [1], { next: 100 });
    expect(fourPlan.created.get(1)?.special).toBe("bomb");
    expect([...fourPlan.cleared].sort()).toEqual([0, 2, 3]);

    const five = boardFrom(withRow(0, "5555503"));
    const fivePlan = planClear(five, findRuns(five), [], [], { next: 100 });
    expect(fivePlan.created.get(2)?.special).toBe("rainbow");
  });

  it("폭탄은 가로·세로 한 줄을 터뜨리고, 그 안의 다른 폭탄도 연쇄로 터진다", () => {
    const board = boardFrom(withRow(3, "B12345B"));
    const plan = planClear(board, [], [3 * BOARD_SIZE], [], { next: 100 });
    const cells = [...plan.cleared];
    // 3행 전체 + 0열 전체 + 6열 전체
    expect(cells.length).toBe(BOARD_SIZE * 3 - 2);
    expect(cells).toContain(0);
    expect(cells).toContain(BOARD_SIZE * BOARD_SIZE - 1);
  });

  it("무지개는 고른 동물을 판에서 전부 터뜨린다", () => {
    const board = boardFrom(withRow(0, "R123456"));
    const plan = planClear(board, [], [0], [], { next: 100 }, 1);
    expect(plan.cleared.has(0)).toBe(true);
    board.forEach((tile, index) => {
      if (tile.special === "none") expect(plan.cleared.has(index)).toBe(tile.kind === 1);
    });
  });

  it("빈칸 위 블록이 내려오고 위는 새 블록으로 채워진다", () => {
    const board = boardFrom(BASE);
    const holes = board.map((tile, index) => (index === 3 * BOARD_SIZE ? null : tile));
    const { board: next, spawned } = collapse(holes, () => 0, { next: 1000 });
    expect(next).toHaveLength(board.length);
    expect(next[3 * BOARD_SIZE].id).toBe(board[2 * BOARD_SIZE].id);
    expect(next[BOARD_SIZE].id).toBe(board[0].id);
    expect(spawned.get(next[0].id)).toBe(1);
    expect(spawned.size).toBe(1);
  });

  it("섞은 판은 같은 블록 그대로, 줄 없이, 둘 수 있는 수가 있다", () => {
    const board = createBoard(Math.random, { next: 0 });
    const shuffled = shuffleBoard(board, Math.random);
    expect(shuffled.map((tile) => tile.id).sort()).toEqual(board.map((tile) => tile.id).sort());
    expect(findRuns(shuffled)).toEqual([]);
    expect(findMove(shuffled)).not.toBeNull();
  });

  it("콤보가 이어질수록, 피버 중일수록 점수가 커진다", () => {
    expect(scoreFor(3, 1, false)).toBe(3 * TILE_POINTS);
    expect(scoreFor(3, 5, false)).toBeGreaterThan(scoreFor(3, 1, false));
    expect(scoreFor(3, 99, false)).toBe(scoreFor(3, 50, false));
    expect(scoreFor(3, 5, true)).toBe(scoreFor(3, 5, false) * 2);
  });
});
