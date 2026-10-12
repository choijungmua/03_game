// 카피바라 배구 물리. 피카츄 배구처럼 네트를 사이에 두고 공을 상대 바닥에 떨어뜨리면 1점.
// 1프레임 = 1/60초. 온라인에서는 방장(왼쪽)만 이걸 돌리고 손님은 받은 상태를 그린다

export const WIDTH = 432;
export const HEIGHT = 304;
/** 공이 여기 닿으면 점수 */
export const GROUND = 272;
export const NET_X = WIDTH / 2;
export const NET_TOP = 176;
export const NET_HALF = 4;
export const PLAYER_R = 28;
export const BALL_R = 18;
export const PLAYER_Y = GROUND - PLAYER_R;
export const WIN_SCORE = 15;
/** 점수가 난 뒤 다음 서브까지 쉬는 프레임 */
export const POINT_PAUSE = 70;

const BALL_GRAVITY = 0.35;
const PLAYER_GRAVITY = 0.8;
const JUMP_SPEED = 14;
const MOVE_SPEED = 5;
/** 스파이크 키를 누른 뒤 공에 닿으면 스파이크가 되는 프레임 수 */
const SPIKE_FRAMES = 14;
/** 한 번 닿은 뒤 다시 닿을 수 있을 때까지 (공이 몸에 붙어 떨리지 않게) */
const TOUCH_COOLDOWN = 8;

export const KEY = { left: 1, right: 2, up: 4, hit: 8, down: 16 } as const;

export type Side = 0 | 1;
export type GameEvent = "bump" | "spike" | "wall" | "point" | "win";

export interface Player {
  x: number;
  y: number;
  vy: number;
  /** 남은 스파이크 프레임 (0이면 일반 리시브) */
  spike: number;
  cooldown: number;
  /** 지난 프레임에 스파이크 키를 누르고 있었는지 (누를 때 한 번만 시작) */
  held: boolean;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface VolleyState {
  players: [Player, Player];
  ball: Ball;
  score: [number, number];
  /** 다음 서브할 쪽 (방금 득점한 쪽) */
  server: Side;
  /** 남은 쉬는 프레임 */
  pause: number;
  winner: Side | null;
}

const homeX = (side: Side) => (side === 0 ? 72 : WIDTH - 72);
const direction = (side: Side) => (side === 0 ? 1 : -1);

function serve(state: VolleyState): VolleyState {
  const player = (side: Side): Player => ({ x: homeX(side), y: PLAYER_Y, vy: 0, spike: 0, cooldown: 0, held: false });
  return { ...state, players: [player(0), player(1)], ball: { x: homeX(state.server), y: 60, vx: 0, vy: 0 } };
}

export function createGame(server: Side = 0): VolleyState {
  return serve({ players: [] as never, ball: {} as Ball, score: [0, 0], server, pause: 0, winner: null });
}

function movePlayer(player: Player, side: Side, keys: number): Player {
  const next = { ...player, cooldown: Math.max(0, player.cooldown - 1), spike: Math.max(0, player.spike - 1) };
  const grounded = player.y >= PLAYER_Y;
  next.x += ((keys & KEY.right ? 1 : 0) - (keys & KEY.left ? 1 : 0)) * MOVE_SPEED;
  const [min, max] = side === 0 ? [PLAYER_R, NET_X - NET_HALF - PLAYER_R] : [NET_X + NET_HALF + PLAYER_R, WIDTH - PLAYER_R];
  next.x = Math.min(max, Math.max(min, next.x));
  if (grounded && keys & KEY.up) next.vy = -JUMP_SPEED;
  next.vy += PLAYER_GRAVITY;
  next.y += next.vy;
  if (next.y >= PLAYER_Y) {
    next.y = PLAYER_Y;
    next.vy = 0;
  }
  const hit = Boolean(keys & KEY.hit);
  // 스파이크는 공중에서만
  if (hit && !player.held && next.y < PLAYER_Y) next.spike = SPIKE_FRAMES;
  next.held = hit;
  return next;
}

/** 공이 몸에 닿으면 튕겨 낸다. 스파이크 중이면 상대 쪽으로 세게 꽂는다 */
function touch(ball: Ball, player: Player, side: Side, keys: number, events: GameEvent[]): [Ball, Player] {
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (player.cooldown > 0 || distance >= BALL_R + PLAYER_R || distance === 0) return [ball, player];
  const nx = dx / distance;
  const ny = dy / distance;
  const out = { ...ball, x: player.x + nx * (BALL_R + PLAYER_R), y: player.y + ny * (BALL_R + PLAYER_R) };
  const dir = direction(side);
  if (player.spike > 0) {
    // 앞(상대 쪽) 키를 누르면 더 길게, 뒤 키를 누르면 짧게. ↓는 꽂기, ↑는 높이 띄우기
    const back = keys & (side === 0 ? KEY.left : KEY.right);
    out.vx = dir * (back ? 7 : 13);
    out.vy = keys & KEY.down ? 8 : keys & KEY.up ? -9 : 2;
    events.push("spike");
  } else {
    out.vx = nx * 9 + dir * 1.5;
    out.vy = Math.min(ny * 9, -9);
    events.push("bump");
  }
  return [out, { ...player, cooldown: TOUCH_COOLDOWN, spike: 0 }];
}

function moveBall(ball: Ball, events: GameEvent[]): Ball {
  const next = { ...ball, vy: ball.vy + BALL_GRAVITY };
  next.x += next.vx;
  next.y += next.vy;
  if (next.x < BALL_R || next.x > WIDTH - BALL_R) {
    next.x = Math.min(WIDTH - BALL_R, Math.max(BALL_R, next.x));
    next.vx = -next.vx;
    events.push("wall");
  }
  if (next.y < BALL_R) {
    next.y = BALL_R;
    next.vy = Math.abs(next.vy);
  }
  // 네트: 꼭대기 위에서 닿으면 위로, 옆에서 닿으면 옆으로 튕긴다
  if (Math.abs(next.x - NET_X) < BALL_R + NET_HALF && next.y + BALL_R > NET_TOP) {
    if (next.y <= NET_TOP) {
      next.y = NET_TOP - BALL_R;
      next.vy = -Math.abs(next.vy) * 0.8;
    } else {
      const left = ball.x < NET_X;
      next.x = NET_X + (left ? -1 : 1) * (BALL_R + NET_HALF);
      next.vx = (left ? -1 : 1) * Math.max(Math.abs(next.vx) * 0.7, 1);
    }
    events.push("wall");
  }
  return next;
}

/** 한 프레임 진행. keys는 [왼쪽, 오른쪽] 키 비트(KEY) */
export function step(state: VolleyState, keys: [number, number]): { state: VolleyState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  if (state.winner !== null) return { state, events };
  if (state.pause > 0) {
    const pause = state.pause - 1;
    return { state: pause === 0 ? serve({ ...state, pause }) : { ...state, pause }, events };
  }
  const players = [movePlayer(state.players[0], 0, keys[0]), movePlayer(state.players[1], 1, keys[1])] as [Player, Player];
  let ball = moveBall(state.ball, events);
  for (const side of [0, 1] as const) [ball, players[side]] = touch(ball, players[side], side, keys[side], events);

  if (ball.y + BALL_R < GROUND) return { state: { ...state, players, ball }, events };
  const scorer: Side = ball.x < NET_X ? 1 : 0;
  const score = [...state.score] as [number, number];
  score[scorer] += 1;
  const winner = score[scorer] >= WIN_SCORE ? scorer : null;
  events.push(winner === null ? "point" : "win");
  return { state: { ...state, players, ball: { ...ball, y: GROUND - BALL_R, vx: 0, vy: 0 }, score, server: scorer, pause: POINT_PAUSE, winner }, events };
}

/** 공이 이 높이(받기 좋은 높이)까지 내려올 때의 x. 벽 튕김만 따지고 네트·사람은 무시한다 */
export function landingX(ball: Ball, height = PLAYER_Y - PLAYER_R) {
  let { x, y, vx, vy } = ball;
  for (let frame = 0; frame < 240 && !(vy > 0 && y >= height); frame += 1) {
    vy += BALL_GRAVITY;
    x += vx;
    y += vy;
    if (x < BALL_R || x > WIDTH - BALL_R) {
      x = Math.min(WIDTH - BALL_R, Math.max(BALL_R, x));
      vx = -vx;
    }
  }
  return x;
}

/**
 * 컴퓨터 입력. 공이 떨어질 자리 조금 뒤에 서서 받고, 공이 머리 위로 오면 뛰어 스파이크한다.
 * error(px)만큼 낙하 지점을 잘못 읽어 사람이 이길 틈을 둔다
 */
export function botKeys(state: VolleyState, side: Side, error = 0): number {
  const me = state.players[side];
  const { ball } = state;
  const dir = direction(side);
  const mine = (x: number) => (side === 0 ? x < NET_X : x > NET_X);
  const landing = landingX(ball) + error;
  const target = state.pause > 0 ? homeX(side) : mine(landing) ? landing - dir * 12 : homeX(side) + dir * 40;
  let keys = 0;
  if (target < me.x - 4) keys |= KEY.left;
  if (target > me.x + 4) keys |= KEY.right;
  const above = me.y - ball.y;
  if (state.pause === 0 && mine(ball.x) && Math.abs(ball.x - me.x) < 36 && above > 60 && above < 150 && ball.vy > 0) keys |= KEY.up;
  if (me.y < PLAYER_Y - 20 && Math.hypot(ball.x - me.x, ball.y - me.y) < 80) keys |= KEY.hit | KEY.down;
  return keys;
}
