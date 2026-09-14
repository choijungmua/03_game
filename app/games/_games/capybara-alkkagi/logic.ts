import { type MoveResult, opponent, type Stone, type Vector } from "@/lib/games/rooms";

/** 판 한 변 길이(좌표 단위). 흑은 아래쪽, 백은 위쪽에서 시작한다 */
export const FIELD = 1000;
export const RADIUS = 45;
/** 대장 카피바라는 크고 무거워서 잘 안 밀린다 (떨어져도 지지는 않는다) */
export const LEADER_RADIUS = 62;
const LEADER_MASS = 2;
/** 한 프레임(1/60초)에 움직일 수 있는 최대 거리 */
export const MAX_SPEED = 26;
export const PER_SIDE = 5;
const LEADER_SLOT = 2; // 가운데 자리
export const TURN_TIME_MS = 20_000;

// 한 프레임마다 속도에 곱하는 값. 알이 멈출 때까지 가는 거리 ≈ 속도 / (1 - FRICTION)
// → 최대 힘으로 혼자 미끄러지면 판의 약 0.65배, 내 줄에서 상대 줄까지 쏴서 맞히면 맞은 알이 판 끝까지는 못 간다
const FRICTION = 0.96;
const STOP_SPEED_SQ = 0.08 * 0.08;
/** 알끼리 부딪힐 때 남는 힘 비율 (1이면 완전 탄성). 낮을수록 연쇄로 튕겨 나가는 게 줄어든다 */
const RESTITUTION = 0.75;
/** 한 프레임을 나눠 계산하는 횟수 — 빠른 알이 다른 알을 뚫고 지나가거나 깊게 겹쳐 튀는 것을 막는다 */
const SUBSTEPS = 4;
const MAX_FRAMES = 1200;

export interface Piece {
  id: number;
  owner: Stone;
  x: number;
  y: number;
  /** 판 밖으로 떨어졌는지 */
  out: boolean;
  /** 대장 카피바라 — 크고 무거운 수비형 알 */
  leader: boolean;
}

export interface Shot {
  seq: number;
  by: Stone;
  pieceId: number;
  velocity: Vector;
  /** 치기 직전 알 위치 — 클라이언트가 같은 시뮬레이션으로 애니메이션을 다시 재생한다 */
  before: Piece[];
  knocked: number;
}

export interface AlkkagiState {
  pieces: Piece[];
  turn: Stone;
  /** 상대 알을 떨어뜨려서 연달아 한 번 더 치는 횟수 */
  combo: number;
  lastShot: Shot | null;
  winner: Stone | null;
  endReason: "knockout" | "resign" | "timeout" | null;
  turnStartedAt: number | null;
}

export function radiusOf(piece: Pick<Piece, "leader">) {
  return piece.leader ? LEADER_RADIUS : RADIUS;
}

function inverseMass(piece: Piece) {
  return piece.leader ? 1 / LEADER_MASS : 1;
}

export function createGame(): AlkkagiState {
  const gap = FIELD / (PER_SIDE + 1);
  const pieces: Piece[] = [];
  for (let i = 0; i < PER_SIDE; i++) {
    const leader = i === LEADER_SLOT;
    pieces.push({ id: i, owner: "black", x: gap * (i + 1), y: 780, out: false, leader });
    pieces.push({ id: PER_SIDE + i, owner: "white", x: gap * (i + 1), y: 220, out: false, leader });
  }
  return { pieces, turn: "black", combo: 0, lastShot: null, winner: null, endReason: null, turnStartedAt: null };
}

// 겹친 두 알을 떼어 놓고, 서로 다가오는 중이면 충격량을 주고받는다. 부딪쳤으면 true
function resolveCollision(a: Piece, b: Piece, va: Vector, vb: Vector) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const reach = radiusOf(a) + radiusOf(b);
  const distanceSq = dx * dx + dy * dy;
  if (distanceSq >= reach * reach) return false;

  // 완전히 같은 자리면 방향을 알 수 없어서 위아래로 뗀다
  const distance = Math.sqrt(distanceSq);
  const nx = distance === 0 ? 0 : dx / distance;
  const ny = distance === 0 ? 1 : dy / distance;
  const invA = inverseMass(a);
  const invB = inverseMass(b);
  const invSum = invA + invB;

  // 겹친 만큼 떼어 놓는데, 무거운 알은 덜 움직인다
  const overlap = reach - distance;
  a.x -= nx * overlap * (invA / invSum);
  a.y -= ny * overlap * (invA / invSum);
  b.x += nx * overlap * (invB / invSum);
  b.y += ny * overlap * (invB / invSum);

  const approach = (va.x - vb.x) * nx + (va.y - vb.y) * ny;
  if (approach <= 0) return false;
  const impulse = (approach * (1 + RESTITUTION)) / invSum;
  va.x -= impulse * invA * nx;
  va.y -= impulse * invA * ny;
  vb.x += impulse * invB * nx;
  vb.y += impulse * invB * ny;
  return true;
}

// 서버·클라이언트가 똑같은 결과를 내도록 고정 스텝 + 사칙연산/sqrt만 쓴다 (Math.hypot·sin·cos는 엔진마다 오차가 달라 금지)
// onStep은 프레임(1/60초)마다 한 번 불린다
export function simulateShot(
  pieces: Piece[],
  pieceId: number,
  velocity: Vector,
  onStep?: (pieces: Piece[], hit: boolean) => void,
): Piece[] {
  const next = pieces.map((piece) => ({ ...piece }));
  const vel = next.map((piece) => (piece.id === pieceId ? { ...velocity } : { x: 0, y: 0 }));

  for (let frame = 0; frame < MAX_FRAMES; frame++) {
    let hit = false;

    for (let sub = 0; sub < SUBSTEPS; sub++) {
      next.forEach((piece, i) => {
        if (piece.out) return;
        piece.x += vel[i].x / SUBSTEPS;
        piece.y += vel[i].y / SUBSTEPS;
        // 알 가운데가 판 끝을 넘으면 떨어진다
        if (piece.x < 0 || piece.x > FIELD || piece.y < 0 || piece.y > FIELD) {
          piece.out = true;
          vel[i] = { x: 0, y: 0 };
        }
      });

      for (let i = 0; i < next.length; i++) {
        for (let j = i + 1; j < next.length; j++) {
          if (next[i].out || next[j].out) continue;
          if (resolveCollision(next[i], next[j], vel[i], vel[j])) hit = true;
        }
      }
    }

    let moving = false;
    next.forEach((piece, i) => {
      if (piece.out) return;
      vel[i].x *= FRICTION;
      vel[i].y *= FRICTION;
      if (vel[i].x * vel[i].x + vel[i].y * vel[i].y < STOP_SPEED_SQ) vel[i] = { x: 0, y: 0 };
      else moving = true;
    });

    onStep?.(next, hit);
    if (!moving) break;
  }

  return next;
}

function aliveCount(pieces: Piece[], owner: Stone) {
  return pieces.filter((piece) => piece.owner === owner && !piece.out).length;
}

export function shoot(state: AlkkagiState, pieceId: number, velocity: Vector, seat: Stone): MoveResult<AlkkagiState> {
  if (state.winner) return { ok: false, error: "이미 끝난 판이에요" };
  if (seat !== state.turn) return { ok: false, error: "상대 차례예요" };
  if (!state.pieces.some((piece) => piece.id === pieceId && piece.owner === seat && !piece.out)) {
    return { ok: false, error: "판 위에 있는 내 알만 칠 수 있어요" };
  }
  if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) return { ok: false, error: "잘못된 방향이에요" };

  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  if (speed < 1) return { ok: false, error: "조금 더 세게 당겨 주세요" };
  const scale = Math.min(1, MAX_SPEED / speed);
  const clamped = { x: velocity.x * scale, y: velocity.y * scale };

  const other = opponent(seat);
  const pieces = simulateShot(state.pieces, pieceId, clamped);
  const knocked = aliveCount(state.pieces, other) - aliveCount(pieces, other);

  // 알이 다 떨어지면 진다. 둘 다 다 떨어지면(같이 떨어짐) 친 사람이 진다
  const winner = aliveCount(pieces, seat) === 0 ? other : aliveCount(pieces, other) === 0 ? seat : null;
  // 상대 알을 떨어뜨리고 친 알이 살아남으면 한 번 더
  const bonus = !winner && knocked > 0 && pieces.some((piece) => piece.id === pieceId && !piece.out);

  return {
    ok: true,
    state: {
      ...state,
      pieces,
      turn: bonus ? seat : other,
      combo: bonus ? state.combo + 1 : 0,
      lastShot: { seq: (state.lastShot?.seq ?? 0) + 1, by: seat, pieceId, velocity: clamped, before: state.pieces, knocked },
      winner,
      endReason: winner ? "knockout" : null,
    },
  };
}

export function resign(state: AlkkagiState, seat: Stone): MoveResult<AlkkagiState> {
  if (state.winner) return { ok: false, error: "이미 끝난 판이에요" };
  return { ok: true, state: { ...state, winner: opponent(seat), endReason: "resign" } };
}

export function timeOut(state: AlkkagiState, stone: Stone): AlkkagiState {
  return { ...state, winner: opponent(stone), endReason: "timeout" };
}
