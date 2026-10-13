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
/** 땅에 닿기 직전에 누른 점프도 받아 준다 (조작이 씹히지 않게) */
const JUMP_BUFFER = 6;
/** 땅에서 스파이크 키를 누르면 바라보는 쪽(또는 누른 쪽)으로 몸을 날린다 */
const DIVE_FRAMES = 22;
const DIVE_SPEED = 8;
/** 스파이크가 맞는 순간 화면이 잠깐 멈추는 프레임 (타격감) */
const SPIKE_FREEZE = 5;

export const KEY = { left: 1, right: 2, up: 4, hit: 8, down: 16 } as const;

export type Side = 0 | 1;
export type GameEvent = "bump" | "spike" | "wall" | "point" | "win" | "jump" | "land" | "dive";

export interface Player {
  x: number;
  y: number;
  vy: number;
  /** 남은 스파이크 프레임 (0이면 일반 리시브) */
  spike: number;
  cooldown: number;
  /** 지난 프레임에 스파이크 키를 누르고 있었는지 (누를 때 한 번만 시작) */
  held: boolean;
  /** 남은 점프 예약 프레임 */
  jumpBuffer: number;
  /** 남은 다이빙 프레임과 방향(-1·1) */
  dive: number;
  diveDir: number;
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
  /** 남은 멈춤 프레임 (스파이크 순간) */
  freeze: number;
}

const homeX = (side: Side) => (side === 0 ? 72 : WIDTH - 72);
const direction = (side: Side) => (side === 0 ? 1 : -1);

function serve(state: VolleyState): VolleyState {
  const player = (side: Side): Player => ({ x: homeX(side), y: PLAYER_Y, vy: 0, spike: 0, cooldown: 0, held: false, jumpBuffer: 0, dive: 0, diveDir: 0 });
  return { ...state, players: [player(0), player(1)], ball: { x: homeX(state.server), y: 60, vx: 0, vy: 0 } };
}

export function createGame(server: Side = 0): VolleyState {
  return serve({ players: [] as never, ball: {} as Ball, score: [0, 0], server, pause: 0, winner: null, freeze: 0 });
}

function movePlayer(player: Player, side: Side, keys: number, events: GameEvent[]): Player {
  const next = { ...player, cooldown: Math.max(0, player.cooldown - 1), spike: Math.max(0, player.spike - 1), dive: Math.max(0, player.dive - 1) };
  const grounded = player.y >= PLAYER_Y;
  const hit = Boolean(keys & KEY.hit);
  const pressedHit = hit && !player.held;
  const axis = (keys & KEY.right ? 1 : 0) - (keys & KEY.left ? 1 : 0);
  if (player.dive > 0) next.x += player.diveDir * DIVE_SPEED * (player.dive / DIVE_FRAMES + 0.3);
  else next.x += axis * MOVE_SPEED;
  const [min, max] = side === 0 ? [PLAYER_R, NET_X - NET_HALF - PLAYER_R] : [NET_X + NET_HALF + PLAYER_R, WIDTH - PLAYER_R];
  next.x = Math.min(max, Math.max(min, next.x));
  next.jumpBuffer = keys & KEY.up ? JUMP_BUFFER : Math.max(0, player.jumpBuffer - 1);
  if (grounded && next.jumpBuffer > 0 && player.dive === 0) {
    next.vy = -JUMP_SPEED;
    next.jumpBuffer = 0;
    events.push("jump");
  }
  next.vy += PLAYER_GRAVITY;
  next.y += next.vy;
  if (next.y >= PLAYER_Y) {
    if (!grounded) events.push("land");
    next.y = PLAYER_Y;
    next.vy = 0;
  }
  // 스파이크는 공중에서, 땅에서는 다이빙
  if (pressedHit && next.y < PLAYER_Y) next.spike = SPIKE_FRAMES;
  else if (pressedHit && grounded && player.dive === 0) {
    next.dive = DIVE_FRAMES;
    next.diveDir = axis || direction(side);
    events.push("dive");
  }
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
    out.vx = dir * (back ? 7 : 14);
    out.vy = keys & KEY.down ? 9 : keys & KEY.up ? -9 : 2;
    events.push("spike");
  } else {
    out.vx = nx * 9 + dir * 1.5;
    out.vy = Math.min(ny * 9, -9);
    // 다이빙 중에 받으면 낮은 공도 높이 띄워 살린다
    if (player.dive > 0) out.vy = -11;
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
  if (state.freeze > 0) return { state: { ...state, freeze: state.freeze - 1 }, events };
  if (state.pause > 0) {
    const pause = state.pause - 1;
    return { state: pause === 0 ? serve({ ...state, pause }) : { ...state, pause }, events };
  }
  const players = [movePlayer(state.players[0], 0, keys[0], events), movePlayer(state.players[1], 1, keys[1], events)] as [Player, Player];
  let ball = moveBall(state.ball, events);
  for (const side of [0, 1] as const) [ball, players[side]] = touch(ball, players[side], side, keys[side], events);

  const freeze = events.includes("spike") ? SPIKE_FREEZE : 0;
  if (ball.y + BALL_R < GROUND) return { state: { ...state, players, ball, freeze }, events };
  const scorer: Side = ball.x < NET_X ? 1 : 0;
  const score = [...state.score] as [number, number];
  score[scorer] += 1;
  const winner = score[scorer] >= WIN_SCORE ? scorer : null;
  events.push(winner === null ? "point" : "win");
  return { state: { ...state, players, ball: { ...ball, y: GROUND - BALL_R, vx: 0, vy: 0 }, score, server: scorer, pause: POINT_PAUSE, winner }, events };
}

/** 공을 실제 물리(벽·천장·네트 튕김)대로 굴려, height까지 내려올 때의 x와 걸린 프레임 */
export function predict(ball: Ball, height = PLAYER_Y - PLAYER_R) {
  const ignored: GameEvent[] = [];
  let next = ball;
  for (let frame = 0; frame < 240; frame += 1) {
    if (next.vy > 0 && next.y >= height) return { x: next.x, frames: frame };
    next = moveBall(next, ignored);
  }
  return { x: next.x, frames: 240 };
}

/** 지금 뛰면 몇 프레임 뒤 내 몸 중심 높이 */
const jumpY = (frames: number) => PLAYER_Y - JUMP_SPEED * frames + (PLAYER_GRAVITY * frames * (frames + 1)) / 2;

/**
 * 컴퓨터 입력.
 * - 네트 튕김까지 계산해 공이 떨어질 자리 뒤쪽(상대 쪽으로 튕겨 보내는 자리)에 선다
 * - 공이 네트 가까이 높이 오면 꼭대기에서 만나게 뛰어 스파이크, 상대가 뒤에 있으면 꽂고 앞에 있으면 길게
 * - 달려서 못 닿는 공은 다이빙
 * error(px)만큼 낙하 지점을 잘못 읽어 사람이 이길 틈을 둔다
 */
export function botKeys(state: VolleyState, side: Side, error = 0): number {
  const me = state.players[side];
  const rival = state.players[side === 0 ? 1 : 0];
  const { ball } = state;
  const dir = direction(side);
  const mine = (x: number) => (side === 0 ? x < NET_X : x > NET_X);
  const grounded = me.y >= PLAYER_Y;
  let keys = 0;
  const walk = (target: number, slack = 3) => {
    if (target < me.x - slack) keys |= KEY.left;
    if (target > me.x + slack) keys |= KEY.right;
  };
  if (state.pause > 0) {
    walk(homeX(side));
    return keys;
  }

  const landing = predict(ball);
  const land = landing.x + error;
  // 공 뒤쪽(네트 반대편)에서 받아야 몸에 맞고 상대 쪽으로 넘어간다
  const receive = land - dir * 14;

  if (!grounded) {
    // 공중: 따라붙어 공 뒤로 가고, 닿을 만하면 스파이크
    walk(ball.x - dir * 10, 2);
    if (Math.hypot(ball.x - me.x, ball.y - me.y) < BALL_R + PLAYER_R + 30 && ball.y < me.y + 10) {
      keys |= KEY.hit;
      const rivalDeep = Math.abs(rival.x - NET_X) > 110;
      const nearNet = Math.abs(me.x - NET_X) < 120;
      // 상대가 뒤에 있거나 내가 네트 가까이면 꽂고, 상대가 네트에 붙어 있으면 머리 넘겨 길게
      if (rivalDeep || nearNet) keys |= KEY.down;
      if (!rivalDeep && !nearNet) keys |= KEY.up;
    }
    return keys;
  }

  if (!mine(land)) {
    // 상대 쪽 공: 가운데쯤에서 기다린다
    walk(homeX(side) + dir * 36);
    return keys;
  }

  walk(receive);

  // 점프 타이밍: 앞으로 8~20프레임 사이, 뛰었을 때 몸과 공이 높은 곳에서 만나면 지금 뛴다
  let probe = ball;
  const ignored: GameEvent[] = [];
  for (let frame = 1; frame <= 22; frame += 1) {
    probe = moveBall(probe, ignored);
    if (frame < 7 || !mine(probe.x)) continue;
    const reach = Math.abs(probe.x - me.x) - frame * MOVE_SPEED;
    const dy = jumpY(frame) - probe.y;
    if (reach < 16 && dy > 10 && dy < 52 && probe.y < PLAYER_Y - 70) {
      keys |= KEY.up;
      break;
    }
  }

  // 달려서 못 닿는 낮은 공: 그쪽으로 다이빙
  const gap = receive - me.x;
  if (!(keys & KEY.up) && Math.abs(gap) > landing.frames * MOVE_SPEED + 8 && landing.frames < 26 && Math.abs(gap) < 150 && !me.held) {
    keys = (keys & ~(KEY.left | KEY.right)) | (gap < 0 ? KEY.left : KEY.right) | KEY.hit;
  }
  return keys;
}
