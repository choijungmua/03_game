import { BOARD_SIZE, COMBO_BONUS_CAP, COMBO_BONUS_POINTS, FEVER_MULTIPLIER, KIND_COUNT, TILE_POINTS } from "./constants";

/** bomb = 4개 매치로 생김, 누르면 가로·세로 한 줄씩 터짐 / rainbow = 5개 매치로 생김, 바꾼 동물을 판에서 전부 터뜨림 */
export type TileSpecial = "none" | "bomb" | "rainbow";

export interface Tile {
  /** 화면에서 같은 블록을 따라가 움직임을 애니메이션하려는 고유 번호 */
  id: number;
  /** 동물 종류 (0..KIND_COUNT-1) */
  kind: number;
  special: TileSpecial;
}

/** 칸 번호 = 행 * BOARD_SIZE + 열 */
export type Board = Tile[];

export type Random = () => number;

export interface IdSource {
  next: number;
}

const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

export const rowOf = (index: number) => Math.floor(index / BOARD_SIZE);
export const colOf = (index: number) => index % BOARD_SIZE;

export function isAdjacent(a: number, b: number) {
  return Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;
}

/** 방향으로 한 칸 옆. 판 밖이면 null */
export function neighbor(index: number, dRow: number, dCol: number): number | null {
  const row = rowOf(index) + dRow;
  const col = colOf(index) + dCol;
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  return row * BOARD_SIZE + col;
}

function newTile(ids: IdSource, kind: number, special: TileSpecial = "none"): Tile {
  ids.next += 1;
  return { id: ids.next, kind, special };
}

const randomKind = (random: Random) => Math.floor(random() * KIND_COUNT);

/** 무지개는 어떤 동물과도 같은 줄로 치지 않는다 */
function sameKind(board: readonly (Tile | null)[], a: number, b: number) {
  const tileA = board[a];
  const tileB = board[b];
  return Boolean(tileA && tileB && tileA.special !== "rainbow" && tileB.special !== "rainbow" && tileA.kind === tileB.kind);
}

/** 가로·세로로 같은 동물이 3개 이상 이어진 줄들 */
export function findRuns(board: Board): number[][] {
  const runs: number[][] = [];
  for (const [dRow, dCol] of [
    [0, 1],
    [1, 0],
  ] as const) {
    for (let start = 0; start < CELL_COUNT; start += 1) {
      const prev = neighbor(start, -dRow, -dCol);
      if (prev !== null && sameKind(board, prev, start)) continue; // 줄의 첫 칸에서만 센다
      const run = [start];
      let next = neighbor(start, dRow, dCol);
      while (next !== null && sameKind(board, run[run.length - 1], next)) {
        run.push(next);
        next = neighbor(next, dRow, dCol);
      }
      if (run.length >= 3) runs.push(run);
    }
  }
  return runs;
}

export function swapTiles(board: Board, a: number, b: number): Board {
  const next = [...board];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** 두 칸을 바꿨을 때 뭔가 터지는지 */
export function isValidSwap(board: Board, a: number, b: number) {
  if (!isAdjacent(a, b)) return false;
  if (board[a].special === "rainbow" || board[b].special === "rainbow") return true;
  return findRuns(swapTiles(board, a, b)).length > 0;
}

/** 터뜨릴 수 있는 한 수. 없으면 null (판을 섞어야 함) */
export function findMove(board: Board): [number, number] | null {
  for (let index = 0; index < CELL_COUNT; index += 1) {
    for (const other of [neighbor(index, 0, 1), neighbor(index, 1, 0)]) {
      if (other !== null && isValidSwap(board, index, other)) return [index, other];
    }
  }
  return null;
}

/** 처음부터 터진 줄이 없고, 둘 수 있는 수가 하나는 있는 판 */
export function createBoard(random: Random, ids: IdSource): Board {
  for (;;) {
    const board: Tile[] = [];
    for (let index = 0; index < CELL_COUNT; index += 1) {
      let kind = randomKind(random);
      const blocked = (k: number) => {
        const left = colOf(index) >= 2 && board[index - 1].kind === k && board[index - 2].kind === k;
        const up = rowOf(index) >= 2 && board[index - BOARD_SIZE].kind === k && board[index - BOARD_SIZE * 2].kind === k;
        return left || up;
      };
      while (blocked(kind)) kind = (kind + 1) % KIND_COUNT;
      board.push(newTile(ids, kind));
    }
    if (findMove(board)) return board;
  }
}

/** 둘 수가 없을 때 같은 블록들을 자리만 섞는다 */
export function shuffleBoard(board: Board, random: Random): Board {
  for (;;) {
    const next = [...board];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    if (findRuns(next).length === 0 && findMove(next)) return next;
  }
}

/** 특수 블록이 터질 때 같이 터지는 칸들. rainbow는 targetKind 동물 전부 */
export function blastArea(board: Board, index: number, targetKind: number): number[] {
  const tile = board[index];
  if (tile.special === "bomb") {
    const cells = new Set<number>();
    for (let i = 0; i < BOARD_SIZE; i += 1) {
      cells.add(rowOf(index) * BOARD_SIZE + i);
      cells.add(i * BOARD_SIZE + colOf(index));
    }
    return [...cells];
  }
  if (tile.special === "rainbow") {
    return [index, ...board.flatMap((other, i) => (other.special !== "rainbow" && other.kind === targetKind ? [i] : []))];
  }
  return [index];
}

/** 판에 가장 많은 동물 — 무지개를 그냥 눌렀거나 연쇄로 터질 때 고르는 대상 */
export function mostCommonKind(board: Board): number {
  const counts = Array.from({ length: KIND_COUNT }, () => 0);
  board.forEach((tile) => {
    if (tile.special !== "rainbow") counts[tile.kind] += 1;
  });
  return counts.indexOf(Math.max(...counts));
}

export interface ClearPlan {
  cleared: Set<number>;
  /** 이번에 새로 생기는 특수 블록 (칸 → 블록). 이 칸은 cleared에 없다 */
  created: Map<number, Tile>;
}

/**
 * 이번에 터질 칸을 정한다. 4개 줄은 폭탄, 5개 이상 줄은 무지개를 남기고,
 * 터지는 칸에 특수 블록이 있으면 그 범위까지 연쇄로 터뜨린다.
 * @param seeds 줄 매치 말고 직접 터뜨릴 칸 (폭탄 누르기·무지개 바꾸기)
 * @param preferred 특수 블록을 남길 자리 우선순위 (방금 옮긴 칸)
 */
export function planClear(
  board: Board,
  runs: readonly number[][],
  seeds: readonly number[],
  preferred: readonly number[],
  ids: IdSource,
  rainbowTarget?: number,
): ClearPlan {
  const cleared = new Set<number>(seeds);
  const created = new Map<number, Tile>();

  for (const run of runs) {
    run.forEach((index) => cleared.add(index));
    if (run.length < 4) continue;
    const spot = preferred.find((index) => run.includes(index) && !created.has(index)) ?? run[Math.floor(run.length / 2)];
    if (created.has(spot)) continue;
    created.set(spot, newTile(ids, board[spot].kind, run.length >= 5 ? "rainbow" : "bomb"));
  }

  // 터지는 칸 안의 특수 블록은 자기 범위를 터뜨린다 — 새로 더해진 칸도 다시 확인
  const triggered = new Set<number>();
  for (let changed = true; changed; ) {
    changed = false;
    for (const index of [...cleared]) {
      if (triggered.has(index) || board[index].special === "none") continue;
      triggered.add(index);
      const target = board[index].special === "rainbow" ? (rainbowTarget ?? mostCommonKind(board)) : board[index].kind;
      for (const cell of blastArea(board, index, target)) {
        if (!cleared.has(cell)) {
          cleared.add(cell);
          changed = true;
        }
      }
    }
  }

  created.forEach((_, index) => cleared.delete(index));
  return { cleared, created };
}

/** 빈칸(null) 위 블록을 아래로 내리고 맨 위를 새 블록으로 채운다. spawned = 새 블록 id → 판 위 몇 칸에서 떨어지는지 */
export function collapse(board: readonly (Tile | null)[], random: Random, ids: IdSource) {
  const next: Tile[] = [];
  const spawned = new Map<number, number>();
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const column: Tile[] = [];
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const tile = board[row * BOARD_SIZE + col];
      if (tile) column.push(tile);
    }
    const missing = BOARD_SIZE - column.length;
    for (let i = 0; i < missing; i += 1) {
      const tile = newTile(ids, randomKind(random));
      spawned.set(tile.id, missing);
      column.push(tile);
    }
    column.forEach((tile, i) => {
      next[(BOARD_SIZE - 1 - i) * BOARD_SIZE + col] = tile;
    });
  }
  return { board: next, spawned };
}

/** 한 번 터질 때 점수. 콤보가 이어질수록 보너스, 피버 중엔 배수 */
export function scoreFor(clearedCount: number, combo: number, fever: boolean) {
  const base = clearedCount * TILE_POINTS + Math.min(Math.max(combo - 1, 0), COMBO_BONUS_CAP) * COMBO_BONUS_POINTS;
  return fever ? base * FEVER_MULTIPLIER : base;
}
