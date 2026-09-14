import { type Cell, type MoveResult, opponent, type Stone } from "@/lib/games/rooms";

export type EndReason = "five" | "resign" | "draw" | "timeout";

export const BOARD_SIZE = 15;
export const WIN_LENGTH = 5;
export const TURN_TIME_MS = 30_000;

export interface GomokuState {
  size: number;
  /** y * size + x 순서의 1차원 판 */
  board: Cell[];
  turn: Stone;
  lastMove: number | null;
  winner: Stone | null;
  /** 이겼을 때 이어진 돌 자리 */
  winLine: number[];
  endReason: EndReason | null;
  /** 방(rooms)이 채우는 차례 시작 시각 */
  turnStartedAt: number | null;
}

// 가로, 세로, 대각선 두 방향
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

export function createGame(size = BOARD_SIZE): GomokuState {
  return {
    size,
    board: Array<Cell>(size * size).fill(null),
    turn: "black",
    lastMove: null,
    winner: null,
    winLine: [],
    endReason: null,
    turnStartedAt: null,
  };
}

// index에서 (dx, dy) 양쪽으로 같은 색이 이어진 자리들
function lineThrough(board: Cell[], size: number, index: number, dx: number, dy: number) {
  const color = board[index];
  const line = [index];
  for (const sign of [1, -1]) {
    let x = (index % size) + dx * sign;
    let y = Math.floor(index / size) + dy * sign;
    while (x >= 0 && x < size && y >= 0 && y < size && board[y * size + x] === color) {
      line.push(y * size + x);
      x += dx * sign;
      y += dy * sign;
    }
  }
  return line;
}

// ponytail: 자유 오목(흑·백 모두 금수 없음, 여섯 개 이상도 승리). 렌주룰(흑 3·3/4·4/장목 금지)이 필요해지면 여기서 흑 수만 추가 검사
export function playMove(state: GomokuState, index: number, stone: Stone): MoveResult<GomokuState> {
  if (state.endReason) return { ok: false, error: "이미 끝난 대국이에요" };
  if (stone !== state.turn) return { ok: false, error: "상대 차례예요" };
  if (!Number.isInteger(index) || index < 0 || index >= state.board.length) {
    return { ok: false, error: "판 밖이에요" };
  }
  if (state.board[index] !== null) return { ok: false, error: "이미 돌이 있어요" };

  const board = state.board.slice();
  board[index] = stone;
  const next: GomokuState = { ...state, board, turn: opponent(stone), lastMove: index };

  for (const [dx, dy] of DIRECTIONS) {
    const line = lineThrough(board, state.size, index, dx, dy);
    if (line.length >= WIN_LENGTH) return { ok: true, state: { ...next, winner: stone, winLine: line, endReason: "five" } };
  }

  if (board.every((cell) => cell !== null)) return { ok: true, state: { ...next, endReason: "draw" } };
  return { ok: true, state: next };
}

export function resign(state: GomokuState, stone: Stone): MoveResult<GomokuState> {
  if (state.endReason) return { ok: false, error: "이미 끝난 대국이에요" };
  return { ok: true, state: { ...state, winner: opponent(stone), endReason: "resign" } };
}

export function timeOut(state: GomokuState, stone: Stone): GomokuState {
  return { ...state, winner: opponent(stone), endReason: "timeout" };
}
