import {
  DAMPING,
  DANGER_GRACE_MS,
  DEADLINE_Y,
  DROP_COOLDOWN_MS,
  DROP_SPEED,
  DROP_Y,
  DROPPABLE_LEVELS,
  FRICTION,
  FRUITS,
  GAME_HEIGHT,
  GAME_OVER_MS,
  GAME_WIDTH,
  GRAVITY,
  GROW_RATE,
  MAX_FRAME_MS,
  MERGE_SLOP,
  RESTITUTION,
  SOLVER_ITERATIONS,
  SUBSTEP_MS,
  WARNING_MARGIN,
  WATERMELON_BONUS,
  WATERMELON_LEVEL,
} from "./constants";

export interface FruitBody {
  id: number;
  /** FRUITS 인덱스 (0 체리 … 10 수박) */
  level: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 지금 반지름. 합쳐진 직후엔 작았다가 FRUITS[level].radius까지 커진다 */
  r: number;
  /** 떨어뜨렸거나 합쳐져 생긴 시각(elapsedMs) */
  bornAt: number;
}

export interface GameState {
  fruits: FruitBody[];
  nextId: number;
  score: number;
  /** 지금 들고 있는 과일 */
  held: number;
  /** 다음에 들 과일 */
  next: number;
  /** 들고 있는 과일의 가로 위치 (clampAim 전) */
  aimX: number;
  cooldownMs: number;
  elapsedMs: number;
  /** 과일이 선을 넘은 채로 이어진 시간 */
  dangerMs: number;
  /** 이번 판에서 만든 가장 큰 과일 */
  maxLevel: number;
  over: boolean;
}

export type GameEvent =
  | { kind: "drop"; level: number }
  /** 같은 과일 두 개가 level 과일 하나(id)가 됨. from은 합쳐진 두 과일의 자리 (우는 얼굴로 모여드는 연출용) */
  | { kind: "merge"; level: number; x: number; y: number; points: number; id: number; from: readonly Point[] }
  /** 수박 두 개가 합쳐져 사라짐 */
  | { kind: "vanish"; x: number; y: number; points: number; from: readonly Point[] };

export interface Point {
  x: number;
  y: number;
}

export type Random = () => number;

function randomLevel(random: Random) {
  return Math.min(DROPPABLE_LEVELS - 1, Math.floor(random() * DROPPABLE_LEVELS));
}

export function createState(random: Random): GameState {
  return {
    fruits: [],
    nextId: 1,
    score: 0,
    held: 0,
    next: randomLevel(random),
    aimX: GAME_WIDTH / 2,
    cooldownMs: 0,
    elapsedMs: 0,
    dangerMs: 0,
    maxLevel: 0,
    over: false,
  };
}

/** 과일이 벽에 박히지 않는 가로 위치 */
export function clampAim(x: number, level: number) {
  const r = FRUITS[level].radius;
  return Math.min(GAME_WIDTH - r, Math.max(r, x));
}

export function canDrop(state: GameState) {
  return !state.over && state.cooldownMs === 0;
}

export function drop(state: GameState, random: Random): GameEvent | null {
  if (!canDrop(state)) return null;
  const level = state.held;
  state.fruits.push({
    id: state.nextId++,
    level,
    x: clampAim(state.aimX, level),
    y: DROP_Y,
    vx: 0,
    vy: DROP_SPEED,
    r: FRUITS[level].radius,
    bornAt: state.elapsedMs,
  });
  state.held = state.next;
  state.next = randomLevel(random);
  state.cooldownMs = DROP_COOLDOWN_MS;
  return { kind: "drop", level };
}

/** 선을 넘어도 봐주는 중(떨어지는 중)이 아닌 과일 */
function settled(state: GameState, fruit: FruitBody) {
  return state.elapsedMs - fruit.bornAt >= DANGER_GRACE_MS;
}

/** 경고선을 깜빡일지: 자리 잡은 과일이 선 근처까지 쌓였거나 이미 넘었다 */
export function isWarning(state: GameState) {
  return state.fruits.some((fruit) => settled(state, fruit) && fruit.y - fruit.r < DEADLINE_Y + WARNING_MARGIN);
}

function keepInside(fruit: FruitBody) {
  if (fruit.x - fruit.r < 0) {
    fruit.x = fruit.r;
    if (fruit.vx < 0) fruit.vx = -fruit.vx * RESTITUTION;
  } else if (fruit.x + fruit.r > GAME_WIDTH) {
    fruit.x = GAME_WIDTH - fruit.r;
    if (fruit.vx > 0) fruit.vx = -fruit.vx * RESTITUTION;
  }
  if (fruit.y + fruit.r > GAME_HEIGHT) {
    fruit.y = GAME_HEIGHT - fruit.r;
    if (fruit.vy > 0) fruit.vy = -fruit.vy * RESTITUTION;
  }
}

function collide(a: FruitBody, b: FruitBody) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let distance = Math.hypot(dx, dy);
  const overlap = a.r + b.r - distance;
  if (overlap <= 0) return;
  if (distance === 0) {
    // 완전히 겹치면 방향이 없다 — 위아래로 떼어 놓는다
    dx = 0;
    dy = 1;
    distance = 1;
  }
  const nx = dx / distance;
  const ny = dy / distance;
  // 질량 ∝ 면적: 큰 과일이 작은 과일을 밀어낸다
  const ma = a.r * a.r;
  const mb = b.r * b.r;
  const total = ma + mb;
  a.x -= (nx * overlap * mb) / total;
  a.y -= (ny * overlap * mb) / total;
  b.x += (nx * overlap * ma) / total;
  b.y += (ny * overlap * ma) / total;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const normalSpeed = rvx * nx + rvy * ny;
  if (normalSpeed >= 0) return;
  const impulse = (-(1 + RESTITUTION) * normalSpeed) / (1 / ma + 1 / mb);
  // 접선 방향 미끄러짐도 조금 줄여 쌓인 과일이 영원히 굴러다니지 않게 한다
  const tx = -ny;
  const ty = nx;
  const tangentImpulse = ((rvx * tx + rvy * ty) * FRICTION) / (1 / ma + 1 / mb);
  a.vx -= (impulse * nx - tangentImpulse * tx) / ma;
  a.vy -= (impulse * ny - tangentImpulse * ty) / ma;
  b.vx += (impulse * nx - tangentImpulse * tx) / mb;
  b.vy += (impulse * ny - tangentImpulse * ty) / mb;
}

function mergeTouching(state: GameState, events: GameEvent[]) {
  const { fruits } = state;
  const merged = new Set<number>();
  const born: FruitBody[] = [];
  for (let i = 0; i < fruits.length; i += 1) {
    const a = fruits[i];
    if (merged.has(a.id)) continue;
    for (let j = i + 1; j < fruits.length; j += 1) {
      const b = fruits[j];
      if (merged.has(b.id) || a.level !== b.level) continue;
      if (Math.hypot(b.x - a.x, b.y - a.y) > a.r + b.r + MERGE_SLOP) continue;
      merged.add(a.id);
      merged.add(b.id);
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      const from = [
        { x: a.x, y: a.y },
        { x: b.x, y: b.y },
      ];
      if (a.level === WATERMELON_LEVEL) {
        state.score += WATERMELON_BONUS;
        events.push({ kind: "vanish", x, y, points: WATERMELON_BONUS, from });
        break;
      }
      const level = a.level + 1;
      const points = FRUITS[level].score;
      state.score += points;
      state.maxLevel = Math.max(state.maxLevel, level);
      const id = state.nextId++;
      born.push({
        id,
        level,
        x,
        y,
        vx: (a.vx + b.vx) / 2,
        vy: (a.vy + b.vy) / 2,
        // 합친 두 과일 크기에서 시작해 커지며 주변 과일을 밀어낸다
        r: a.r,
        bornAt: state.elapsedMs,
      });
      events.push({ kind: "merge", level, x, y, points, id, from });
      break;
    }
  }
  if (merged.size === 0) return;
  state.fruits = [...fruits.filter((fruit) => !merged.has(fruit.id)), ...born];
}

function substep(state: GameState, ms: number, events: GameEvent[]) {
  const dt = ms / 1000;
  state.elapsedMs += ms;
  const damping = Math.max(0, 1 - DAMPING * dt);
  for (const fruit of state.fruits) {
    const target = FRUITS[fruit.level].radius;
    fruit.r += (target - fruit.r) * Math.min(1, GROW_RATE * dt);
    if (target - fruit.r < 0.05) fruit.r = target;
    fruit.vy += GRAVITY * dt;
    fruit.vx *= damping;
    fruit.vy *= damping;
    fruit.x += fruit.vx * dt;
    fruit.y += fruit.vy * dt;
  }
  // ponytail: 모든 쌍을 검사(O(n²)). 판에 과일이 수십 개라 충분하다. 수백 개가 되면 가로 격자로 나눈다
  for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration += 1) {
    const { fruits } = state;
    for (let i = 0; i < fruits.length; i += 1) {
      for (let j = i + 1; j < fruits.length; j += 1) collide(fruits[i], fruits[j]);
    }
    for (const fruit of fruits) keepInside(fruit);
  }
  mergeTouching(state, events);

  const overLine = state.fruits.some((fruit) => settled(state, fruit) && fruit.y - fruit.r < DEADLINE_Y);
  state.dangerMs = overLine ? state.dangerMs + ms : 0;
  if (state.dangerMs >= GAME_OVER_MS) state.over = true;
}

/** deltaMs만큼 시간을 흘린다. 이번에 일어난 합체를 돌려준다 (소리·연출용) */
export function step(state: GameState, deltaMs: number): GameEvent[] {
  const events: GameEvent[] = [];
  let remaining = Math.min(Math.max(0, deltaMs), MAX_FRAME_MS);
  state.cooldownMs = Math.max(0, state.cooldownMs - remaining);
  while (remaining > 0 && !state.over) {
    const ms = Math.min(SUBSTEP_MS, remaining);
    substep(state, ms, events);
    remaining -= ms;
  }
  return events;
}
