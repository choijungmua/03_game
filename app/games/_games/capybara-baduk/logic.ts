import { type Cell, type MoveResult as RoomMoveResult, opponent, type Stone } from "@/lib/games/rooms";

export { type Cell, opponent, type Stone };
export type EndReason = "pass" | "resign" | "timeout";

export const BOARD_SIZE = 9;
export const KOMI = 6.5;
export const TURN_TIME_MS = 60_000;

export interface GoState {
  size: number;
  /** y * size + x 순서의 1차원 판 */
  board: Cell[];
  turn: Stone;
  captures: Record<Stone, number>;
  /** 바로 되따내면 안 되는 패 자리 */
  koPoint: number | null;
  consecutivePasses: number;
  lastMove: number | null;
  winner: Stone | null;
  endReason: EndReason | null;
  /** 두 번 연속 패스로 끝났을 때만 채워진다 */
  finalScore: Record<Stone, number> | null;
  /** 방(rooms)이 채우는 차례 시작 시각 */
  turnStartedAt: number | null;
}

export type MoveResult = RoomMoveResult<GoState>;

export function createGame(size = BOARD_SIZE): GoState {
  return {
    size,
    board: Array<Cell>(size * size).fill(null),
    turn: "black",
    captures: { black: 0, white: 0 },
    koPoint: null,
    consecutivePasses: 0,
    lastMove: null,
    winner: null,
    endReason: null,
    finalScore: null,
    turnStartedAt: null,
  };
}

function neighbors(index: number, size: number) {
  const x = index % size;
  const result: number[] = [];
  if (x > 0) result.push(index - 1);
  if (x < size - 1) result.push(index + 1);
  if (index >= size) result.push(index - size);
  if (index < size * (size - 1)) result.push(index + size);
  return result;
}

// start와 같은 색으로 이어진 돌 묶음과 그 묶음의 활로 수
function getGroup(board: Cell[], size: number, start: number) {
  const color = board[start];
  const stones = [start];
  const seen = new Set(stones);
  const liberties = new Set<number>();
  for (let i = 0; i < stones.length; i++) {
    for (const next of neighbors(stones[i], size)) {
      if (board[next] === null) liberties.add(next);
      else if (board[next] === color && !seen.has(next)) {
        seen.add(next);
        stones.push(next);
      }
    }
  }
  return { stones, liberties: liberties.size };
}

function checkTurn(state: GoState, stone: Stone): string | null {
  if (state.winner) return "이미 끝난 대국이에요";
  if (stone !== state.turn) return "상대 차례예요";
  return null;
}

export function playMove(state: GoState, index: number, stone: Stone): MoveResult {
  const turnError = checkTurn(state, stone);
  if (turnError) return { ok: false, error: turnError };
  if (!Number.isInteger(index) || index < 0 || index >= state.board.length) {
    return { ok: false, error: "판 밖이에요" };
  }
  if (state.board[index] !== null) return { ok: false, error: "이미 돌이 있어요" };
  if (index === state.koPoint) return { ok: false, error: "패라서 바로 되따낼 수 없어요" };

  const board = state.board.slice();
  board[index] = stone;

  const captured: number[] = [];
  for (const next of neighbors(index, state.size)) {
    if (board[next] !== opponent(stone)) continue;
    const group = getGroup(board, state.size, next);
    if (group.liberties > 0) continue;
    for (const s of group.stones) board[s] = null;
    captured.push(...group.stones);
  }

  const own = getGroup(board, state.size, index);
  if (own.liberties === 0) return { ok: false, error: "둘 수 없는 자리예요 (자충수)" };

  // 한 점을 따냈고, 둔 돌도 한 점짜리 단수면 상대가 바로 되따내는 패 모양이다
  const isKo = captured.length === 1 && own.stones.length === 1 && own.liberties === 1;

  return {
    ok: true,
    state: {
      ...state,
      board,
      turn: opponent(stone),
      captures: { ...state.captures, [stone]: state.captures[stone] + captured.length },
      koPoint: isKo ? captured[0] : null,
      consecutivePasses: 0,
      lastMove: index,
    },
  };
}

export function passTurn(state: GoState, stone: Stone): MoveResult {
  const turnError = checkTurn(state, stone);
  if (turnError) return { ok: false, error: turnError };

  const next: GoState = {
    ...state,
    turn: opponent(stone),
    koPoint: null,
    consecutivePasses: state.consecutivePasses + 1,
    lastMove: null,
  };
  if (next.consecutivePasses < 2) return { ok: true, state: next };

  const finalScore = scoreGame(next);
  return {
    ok: true,
    state: {
      ...next,
      finalScore,
      winner: finalScore.black > finalScore.white ? "black" : "white",
      endReason: "pass",
    },
  };
}

export function resign(state: GoState, stone: Stone): MoveResult {
  if (state.winner) return { ok: false, error: "이미 끝난 대국이에요" };
  return { ok: true, state: { ...state, winner: opponent(stone), endReason: "resign" } };
}

export function timeOut(state: GoState, stone: Stone): GoState {
  return { ...state, winner: opponent(stone), endReason: "timeout" };
}

// ponytail: 중국식 계가(판 위 돌 + 한 색으로만 둘러싼 빈 곳)라 죽은 돌은 따로 들어내지 않는다.
// 패스 전에 죽은 돌을 직접 따내야 정확함 — 사석 표시 단계가 필요해지면 그때 추가
export function scoreGame(state: GoState): Record<Stone, number> {
  const { board, size } = state;
  const score: Record<Stone, number> = { black: 0, white: KOMI };
  const seen = new Set<number>();

  board.forEach((cell, index) => {
    if (cell) {
      score[cell] += 1;
      return;
    }
    if (seen.has(index)) return;

    seen.add(index);
    const region = [index];
    const borders = new Set<Stone>();
    for (let i = 0; i < region.length; i++) {
      for (const next of neighbors(region[i], size)) {
        const neighbor = board[next];
        if (neighbor) borders.add(neighbor);
        else if (!seen.has(next)) {
          seen.add(next);
          region.push(next);
        }
      }
    }
    if (borders.size === 1) {
      const [owner] = borders;
      score[owner] += region.length;
    }
  });

  return score;
}
