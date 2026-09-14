export type WeaponKind = "basic" | "double" | "spread" | "rapid" | "pierce";
export type ItemKind = WeaponKind | "heal";
export type EnemyKind = "straight" | "zigzag" | "shooter" | "boss";
/** 적이 떨어뜨리는 아이템 (기본총은 시작할 때만 쓴다) */
export type DropKind = Exclude<ItemKind, "basic">;
/** 보스 공격 패턴: 원형 확산 · 돌격 · 격자 · 조준 부채꼴 · 나선 */
export type BossPattern = "ring" | "charge" | "grid" | "fan" | "spiral";

export interface Circle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
}

export interface Bullet extends Circle {
  /** 무기마다 총알 그림이 다르고, 관통총 총알은 적을 뚫고 지나간다 */
  weapon: WeaponKind;
  /** 관통탄이 같은 적을 매 프레임 다시 맞히지 않도록 이미 맞힌 적 id를 기억한다 */
  hitIds: number[];
}

export interface Enemy extends Circle {
  id: number;
  kind: EnemyKind;
  hp: number;
  fireInMs: number;
  /** 맞았을 때 잠깐 하얗게 번쩍이는 시간 */
  flashMs: number;
}

export interface Item extends Circle {
  kind: DropKind;
}

export interface Shot extends Circle {
  /** 보스 탄과 조준 사격 적의 탄은 그림이 다르다 */
  fromBoss: boolean;
}

export interface Explosion {
  x: number;
  y: number;
  size: number;
  ageMs: number;
}

export interface GameState {
  width: number;
  height: number;
  planeX: number;
  /** 이번 프레임에 움직인 방향. 비행기가 기우는 그림을 고르는 데 쓴다 */
  bank: -1 | 0 | 1;
  hp: number;
  invincibleMs: number;
  weapon: WeaponKind;
  fireInMs: number;
  stage: number;
  stageKills: number;
  /** 배너가 끝난 뒤 이번 스테이지를 진행한 시간 */
  stageTimeMs: number;
  bannerMs: number;
  score: number;
  spawnInMs: number;
  nextId: number;
  bossAngle: number;
  /** 지금 보스가 쓰는 패턴 순번 (BOSS_PATTERNS를 돌아가며 쓴다) */
  bossPatternIndex: number;
  bossPatternMs: number;
  /** 돌격 패턴이 향하는 x (예고가 끝나는 순간 고정) */
  bossChargeX: number;
  /** 격자 패턴에서 줄마다 반 칸씩 어긋나게 하려고 센다 */
  bossGridRow: number;
  bullets: Bullet[];
  enemies: Enemy[];
  shots: Shot[];
  items: Item[];
  explosions: Explosion[];
}

export interface GameInput {
  /** 키보드로 누르고 있는 방향 */
  direction: -1 | 0 | 1;
  /** 드래그 중이면 비행기가 가야 할 x, 아니면 null */
  targetX: number | null;
}

/** 비행기 중심이 화면 높이의 몇 % 지점에 있는지 */
export const PLANE_Y_RATIO = 0.84;
/** 날개 끝까지의 절반 폭. 화면 밖으로 날개가 잘리지 않게 이만큼 안쪽에서 멈춘다 */
export const PLANE_HALF_WIDTH = 20;
/** 그림보다 작게 잡은 피격 반경 (억울하게 맞지 않게) */
export const PLANE_HIT_RADIUS = 8;
/** 아이템은 넉넉하게 먹히도록 피격 반경보다 크게 잡는다 */
export const PLANE_PICKUP_RADIUS = 24;
/** 키보드 이동 속도 (px/초) */
export const PLANE_SPEED = 520;
export const MAX_HP = 3;
/** 맞은 뒤 연달아 맞지 않는 시간 */
export const INVINCIBLE_MS = 1000;
export const BULLET_SPEED = 720;
export const STAGE_BANNER_MS = 1500;
export const BOSS_STAGE_EVERY = 5;
export const BOSS_RADIUS = 44;
/** 보스가 내려와 멈추는 높이 */
export const BOSS_Y_RATIO = 0.18;
/** 보스전 한 번에 패턴이 이 순서로 돌아간다. 보스마다 시작 패턴이 한 칸씩 밀린다 */
export const BOSS_PATTERNS: readonly BossPattern[] = ["ring", "charge", "grid", "fan", "spiral"];
/** 패턴 하나를 유지하는 시간 */
export const BOSS_PATTERN_MS: Record<BossPattern, number> = {
  ring: 4000,
  charge: 2800,
  grid: 4500,
  fan: 3500,
  spiral: 4000,
};
export const BOSS_PATTERN_LABELS: Record<BossPattern, string> = {
  ring: "원형 확산",
  charge: "돌격",
  grid: "격자 탄",
  fan: "조준 부채꼴",
  spiral: "나선 탄",
};
/** 돌격 전에 경로를 붉게 예고하는 시간 (옆으로 비켜날 여유) */
export const CHARGE_WINDUP_MS = 700;
/** 예고 뒤 비행기 높이까지 내리꽂는 시간 */
export const CHARGE_DASH_MS = 800;
export const ITEM_RADIUS = 13;
/** 폭발 애니메이션 4프레임이 재생되는 시간 */
export const EXPLOSION_MS = 400;
export const KILL_SCORE = 100;
export const STAGE_CLEAR_SCORE = 500;
export const BOSS_CLEAR_SCORE = 3000;
/** 탭이 백그라운드에서 돌아왔을 때 한 번에 튀지 않도록 프레임 간격 상한을 둔다 */
export const MAX_FRAME_MS = 50;

/** 카피바라 간식이 곧 무기다 (HUD에 보이는 이름) */
export const ITEMS: Record<ItemKind, { label: string }> = {
  basic: { label: "풀잎탄" },
  double: { label: "해바라기씨 쌍발" },
  spread: { label: "귤 산탄" },
  rapid: { label: "옥수수 연사" },
  pierce: { label: "사탕수수 관통" },
  heal: { label: "유자 온천 회복" },
};

export const FIRE_INTERVAL_MS: Record<WeaponKind, number> = {
  basic: 120,
  double: 130,
  spread: 180,
  rapid: 60,
  pierce: 150,
};

/**
 * 적 한 마리를 격추할 때 아이템 종류별로 떨어질 확률 (합계 2.2%).
 * 무기는 쌍발 < 산탄 < 연사 < 관통 순으로 강하고, 좋은 무기일수록 드물다
 */
export const DROP_CHANCES: Record<DropKind, number> = {
  double: 0.008,
  heal: 0.006,
  spread: 0.004,
  rapid: 0.0025,
  pierce: 0.0015,
};

/** 한 번만 굴려서 아이템 하나를 고르거나, 아무것도 떨어뜨리지 않는다(null) */
export function pickDrop(random: () => number = Math.random): DropKind | null {
  let roll = random();
  for (const [kind, chance] of Object.entries(DROP_CHANCES) as [DropKind, number][]) {
    if (roll < chance) return kind;
    roll -= chance;
  }
  return null;
}

export function isBossStage(stage: number) {
  return stage % BOSS_STAGE_EVERY === 0;
}

/** 이 스테이지에서 최고 난이도에 도달하고, 그 뒤로는 유지된다 */
export const PEAK_STAGE = 25;

function lerp(easy: number, hard: number, difficulty: number) {
  return easy + (hard - easy) * difficulty;
}

/** 0(1스테이지) → 1(PEAK_STAGE). 제곱 곡선이라 초반은 천천히, 후반은 가파르게 어려워진다 */
export function getDifficulty(stage: number) {
  const progress = Math.min(1, Math.max(0, (stage - 1) / (PEAK_STAGE - 1)));
  return progress * progress;
}

/**
 * 스테이지는 끝이 없고, 쉬운 값에서 어려운 값으로 난이도 곡선을 따라 옮겨간다.
 * 어려운 쪽 값이 곧 상한이라 최고 난이도도 눈으로 보고 피할 수 있는 한계를 넘지 않는다
 */
export function getStageConfig(stage: number) {
  const boss = isBossStage(stage);
  const d = getDifficulty(stage);
  return {
    boss,
    killGoal: Math.round(lerp(10, 40, d)),
    // 보스전은 패턴 다섯 가지를 한 바퀴 볼 만큼 길다
    bossSurviveMs: Math.round(lerp(22_000, 38_000, d)),
    spawnIntervalMs: lerp(750, 260, d) * (boss ? 2.5 : 1),
    enemyHp: Math.round(lerp(2, 10, d)),
    enemySpeed: lerp(100, 360, d),
    zigzagChance: stage >= 2 ? lerp(0.2, 0.35, d) : 0,
    shooterChance: stage >= 3 ? lerp(0.1, 0.5, d) : 0,
    enemyFireIntervalMs: lerp(2000, 550, d),
    shotSpeed: lerp(160, 420, d),
  };
}

export function createState(width: number, height: number): GameState {
  return {
    width,
    height,
    planeX: width / 2,
    bank: 0,
    hp: MAX_HP,
    invincibleMs: 0,
    weapon: "basic",
    fireInMs: 0,
    stage: 1,
    stageKills: 0,
    stageTimeMs: 0,
    bannerMs: STAGE_BANNER_MS,
    score: 0,
    spawnInMs: 0,
    nextId: 1,
    bossAngle: 0,
    bossPatternIndex: 0,
    bossPatternMs: 0,
    bossChargeX: width / 2,
    bossGridRow: 0,
    bullets: [],
    enemies: [],
    shots: [],
    items: [],
    explosions: [],
  };
}

export function getPlaneY(state: Pick<GameState, "height">) {
  return state.height * PLANE_Y_RATIO;
}

/** 보스 스테이지면 남은 버티기 시간, 아니면 null */
export function getBossLeftMs(state: GameState) {
  const config = getStageConfig(state.stage);
  return config.boss ? Math.max(0, config.bossSurviveMs - state.stageTimeMs) : null;
}

function overlaps(a: Circle, b: Circle, radius = a.r + b.r) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < radius ** 2;
}

function moveCircle(circle: Circle, seconds: number, width: number) {
  circle.x += circle.vx * seconds;
  circle.y += circle.vy * seconds;
  if (circle.x < circle.r || circle.x > width - circle.r) {
    circle.vx = -circle.vx;
    circle.x = Math.min(width - circle.r, Math.max(circle.r, circle.x));
  }
}

function radialShot(x: number, y: number, angle: number, speed: number, fromBoss = true): Shot {
  return { x, y, r: 5, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, fromBoss };
}

function aimedShot(state: GameState, x: number, y: number, speed: number, offset = 0, fromBoss = true): Shot {
  const angle = Math.atan2(getPlaneY(state) - y, state.planeX - x) + offset;
  return radialShot(x, y, angle, speed, fromBoss);
}

function explode(state: GameState, enemy: Enemy) {
  state.explosions.push({ x: enemy.x, y: enemy.y, size: enemy.r * 3.2, ageMs: 0 });
}

export function fireWeapon(state: GameState) {
  const x = state.planeX;
  const y = getPlaneY(state) - 22;
  const weapon = state.weapon;
  const bullet = (dx: number, angle = 0): Bullet => ({
    x: x + dx,
    y,
    r: weapon === "pierce" ? 5 : 3,
    vx: Math.sin(angle) * BULLET_SPEED,
    vy: -Math.cos(angle) * BULLET_SPEED,
    weapon,
    hitIds: [],
  });

  switch (weapon) {
    case "double":
      state.bullets.push(bullet(-7), bullet(7));
      break;
    case "spread":
      state.bullets.push(bullet(0, -0.22), bullet(0), bullet(0, 0.22));
      break;
    default:
      state.bullets.push(bullet(0));
  }
}

export function spawnEnemy(state: GameState, random: () => number = Math.random): Enemy {
  const config = getStageConfig(state.stage);
  const roll = random();
  const kind: EnemyKind =
    roll < config.shooterChance
      ? "shooter"
      : roll < config.shooterChance + config.zigzagChance
        ? "zigzag"
        : "straight";
  const r = kind === "shooter" ? 18 : 15;
  const speed = config.enemySpeed * (kind === "shooter" ? 0.45 : 1);
  return {
    id: state.nextId++,
    kind,
    x: r + random() * (state.width - r * 2),
    y: -r,
    r,
    vx: kind === "zigzag" ? (random() < 0.5 ? -1 : 1) * speed * 0.7 : 0,
    vy: speed,
    hp: config.enemyHp,
    fireInMs: config.enemyFireIntervalMs * random(),
    flashMs: 0,
  };
}

function spawnBoss(state: GameState): Enemy {
  // 보스마다 시작 패턴을 한 칸씩 밀어 매번 다른 순서로 시작한다
  state.bossPatternIndex = state.stage / BOSS_STAGE_EVERY - 1;
  state.bossPatternMs = 0;
  state.bossGridRow = 0;
  return {
    id: state.nextId++,
    kind: "boss",
    x: state.width / 2,
    y: -BOSS_RADIUS,
    r: BOSS_RADIUS,
    vx: 80 + state.stage * 4,
    vy: 70,
    hp: 1,
    fireInMs: 600,
    flashMs: 0,
  };
}

export function getBossPattern(state: Pick<GameState, "bossPatternIndex">): BossPattern {
  return BOSS_PATTERNS[state.bossPatternIndex % BOSS_PATTERNS.length];
}

export function getBossHomeY(state: Pick<GameState, "height">) {
  return state.height * BOSS_Y_RATIO;
}

/** 탄을 쏘는 패턴의 한 번 발사. 다음 발사까지의 간격을 돌려준다 */
function fireBoss(
  state: GameState,
  boss: Enemy,
  pattern: Exclude<BossPattern, "charge">,
  random: () => number,
): number {
  const d = getDifficulty(state.stage);
  const speed = getStageConfig(state.stage).shotSpeed;

  // 어려운 쪽 값도 비행기 근처 탄 사이 틈이 비행기 피격 폭보다 넉넉히 남는 선에서 멈춘다
  switch (pattern) {
    case "ring": {
      // 보스 한가운데서 원형으로 퍼진다. 링마다 반 칸씩 돌려 틈 위치가 바뀐다
      const count = Math.round(lerp(12, 30, d));
      state.bossAngle += Math.PI / count;
      for (let i = 0; i < count; i += 1) {
        state.shots.push(radialShot(boss.x, boss.y, (i / count) * Math.PI * 2 + state.bossAngle, speed * 0.85));
      }
      return lerp(1300, 650, d);
    }
    case "grid": {
      // 화면 위에서 격자 모양 탄 줄이 내려온다. 줄마다 반 칸 어긋나고, 두 칸짜리 빈틈이 하나 있다
      const spacing = lerp(90, 62, d);
      const offset = state.bossGridRow % 2 === 0 ? spacing / 4 : (spacing * 3) / 4;
      const columns = Math.floor((state.width - offset) / spacing) + 1;
      const gap = Math.floor(random() * Math.max(1, columns - 1));
      for (let column = 0; column < columns; column += 1) {
        if (column === gap || column === gap + 1) continue;
        state.shots.push({ x: offset + column * spacing, y: 0, r: 5, vx: 0, vy: speed * 0.75, fromBoss: true });
      }
      state.bossGridRow += 1;
      return lerp(900, 520, d);
    }
    case "fan": {
      const half = Math.round(lerp(1, 3, d));
      for (let i = -half; i <= half; i += 1) {
        state.shots.push(aimedShot(state, boss.x, boss.y + boss.r * 0.6, speed * 1.1, i * 0.16));
      }
      return lerp(1100, 450, d);
    }
    case "spiral": {
      const arms = d < 0.5 ? 3 : 4;
      for (let arm = 0; arm < arms; arm += 1) {
        state.shots.push(radialShot(boss.x, boss.y, state.bossAngle + (arm * Math.PI * 2) / arms, speed));
      }
      state.bossAngle += 0.35;
      return lerp(170, 80, d);
    }
  }
}

/** 보스 한 프레임: 내려와 자리 잡은 뒤, 패턴을 시간마다 바꿔 가며 공격한다 */
function updateBoss(state: GameState, boss: Enemy, dt: number, random: () => number) {
  const seconds = dt / 1000;
  const homeY = getBossHomeY(state);

  if (boss.y < homeY && state.bossPatternMs === 0) {
    boss.y = Math.min(homeY, boss.y + boss.vy * seconds);
    return;
  }

  const pattern = getBossPattern(state);
  state.bossPatternMs += dt;

  if (pattern === "charge") {
    const t = state.bossPatternMs;
    if (t < CHARGE_WINDUP_MS) {
      // 예고하는 동안은 비행기를 따라 조준하다가, 예고가 끝나는 순간의 위치로 돌격한다
      state.bossChargeX = Math.min(state.width - boss.r, Math.max(boss.r, state.planeX));
    } else if (t < CHARGE_WINDUP_MS + CHARGE_DASH_MS) {
      boss.x += (state.bossChargeX - boss.x) * Math.min(1, seconds * 10);
      boss.y = Math.min(getPlaneY(state), boss.y + lerp(700, 1100, getDifficulty(state.stage)) * seconds);
    } else {
      boss.y = Math.max(homeY, boss.y - 420 * seconds);
    }
  } else {
    // 좌우로 오가며 쏜다
    boss.x += boss.vx * seconds;
    if (boss.x < boss.r || boss.x > state.width - boss.r) {
      boss.vx = -boss.vx;
      boss.x = Math.min(state.width - boss.r, Math.max(boss.r, boss.x));
    }
    boss.fireInMs -= dt;
    if (boss.fireInMs <= 0) boss.fireInMs = fireBoss(state, boss, pattern, random);
  }

  // 돌격에서 제자리로 돌아온 뒤에야 다음 패턴으로 넘어간다
  if (state.bossPatternMs >= BOSS_PATTERN_MS[pattern] && boss.y <= homeY) {
    state.bossPatternIndex += 1;
    state.bossPatternMs = 0;
    boss.fireInMs = 500;
  }
}

function applyItem(state: GameState, kind: DropKind) {
  if (kind === "heal") state.hp = Math.min(MAX_HP, state.hp + 1);
  else state.weapon = kind;
  state.score += 50;
}

function damagePlane(state: GameState) {
  state.hp -= 1;
  state.invincibleMs = INVINCIBLE_MS;
}

function advanceStage(state: GameState) {
  state.score += getStageConfig(state.stage).boss ? BOSS_CLEAR_SCORE : STAGE_CLEAR_SCORE;
  state.stage += 1;
  state.stageKills = 0;
  state.stageTimeMs = 0;
  state.bannerMs = STAGE_BANNER_MS;
  state.spawnInMs = 0;
  // 다음 스테이지는 숨 돌릴 틈을 주고 시작한다
  state.enemies = [];
  state.shots = [];
}

/** 한 프레임을 진행한다. 캔버스 루프에서 매 프레임 부르므로 새 객체를 만들지 않고 state를 직접 고친다 */
export function step(
  state: GameState,
  frameMs: number,
  input: GameInput,
  random: () => number = Math.random,
) {
  if (state.hp <= 0) return;
  // rAF 첫 프레임 시각은 루프를 건 시각보다 빠를 수 있어 음수 간격이 들어온다. 시간이 거꾸로 가지 않게 막는다
  const dt = Math.min(Math.max(frameMs, 0), MAX_FRAME_MS);
  const seconds = dt / 1000;
  const config = getStageConfig(state.stage);
  const planeY = getPlaneY(state);

  state.invincibleMs = Math.max(0, state.invincibleMs - dt);
  state.bannerMs = Math.max(0, state.bannerMs - dt);

  const movedX =
    input.targetX !== null ? input.targetX : state.planeX + input.direction * PLANE_SPEED * seconds;
  const prevX = state.planeX;
  state.planeX = Math.min(state.width - PLANE_HALF_WIDTH, Math.max(PLANE_HALF_WIDTH, movedX));
  const movedBy = state.planeX - prevX;
  state.bank = Math.abs(movedBy) < 0.5 ? 0 : movedBy < 0 ? -1 : 1;

  // 총은 항상 자동으로 나간다
  state.fireInMs -= dt;
  if (state.fireInMs <= 0) {
    fireWeapon(state);
    state.fireInMs += FIRE_INTERVAL_MS[state.weapon];
  }

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * seconds;
    bullet.y += bullet.vy * seconds;
  }
  for (const shot of state.shots) {
    shot.x += shot.vx * seconds;
    shot.y += shot.vy * seconds;
  }
  for (const item of state.items) moveCircle(item, seconds, state.width);
  for (const explosion of state.explosions) explosion.ageMs += dt;

  for (const enemy of state.enemies) {
    enemy.flashMs = Math.max(0, enemy.flashMs - dt);
    if (enemy.kind === "boss") {
      updateBoss(state, enemy, dt, random);
      continue;
    }

    moveCircle(enemy, seconds, state.width);
    if (enemy.kind !== "shooter" || enemy.y < 0) continue;
    enemy.fireInMs -= dt;
    if (enemy.fireInMs > 0) continue;
    state.shots.push(aimedShot(state, enemy.x, enemy.y + enemy.r, config.shotSpeed, 0, false));
    enemy.fireInMs = config.enemyFireIntervalMs;
  }

  if (state.bannerMs <= 0) {
    state.stageTimeMs += dt;
    if (config.boss && !state.enemies.some((enemy) => enemy.kind === "boss")) {
      state.enemies.push(spawnBoss(state));
    }
    state.spawnInMs -= dt;
    if (state.spawnInMs <= 0) {
      state.enemies.push(spawnEnemy(state, random));
      state.spawnInMs = config.spawnIntervalMs;
    }
  }

  // 내 총알 → 적. 보스는 맞아도 번쩍이기만 하고 죽지 않는다
  const spent = new Set<Bullet>();
  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || bullet.hitIds.includes(enemy.id) || !overlaps(bullet, enemy)) continue;
      enemy.flashMs = 80;
      if (enemy.kind === "boss") {
        spent.add(bullet);
        break;
      }
      enemy.hp -= 1;
      if (enemy.hp <= 0) {
        state.score += KILL_SCORE;
        state.stageKills += 1;
        explode(state, enemy);
        const kind = pickDrop(random);
        if (kind) state.items.push({ kind, x: enemy.x, y: enemy.y, r: ITEM_RADIUS, vx: 60, vy: 90 });
      }
      if (bullet.weapon !== "pierce") {
        spent.add(bullet);
        break;
      }
      bullet.hitIds.push(enemy.id);
    }
  }

  const plane: Circle = { x: state.planeX, y: planeY, r: PLANE_HIT_RADIUS, vx: 0, vy: 0 };
  if (state.invincibleMs <= 0) {
    const rammed = state.enemies.find((enemy) => enemy.hp > 0 && overlaps(enemy, plane));
    const shot = state.shots.find((candidate) => overlaps(candidate, plane));
    if (rammed || shot) {
      damagePlane(state);
      // 부딪힌 일반 적은 같이 부서진다
      if (rammed && rammed.kind !== "boss") {
        rammed.hp = 0;
        explode(state, rammed);
      }
      if (shot) state.shots = state.shots.filter((candidate) => candidate !== shot);
    }
  }

  const picked = state.items.filter((item) => overlaps(item, plane, PLANE_PICKUP_RADIUS));
  for (const item of picked) applyItem(state, item.kind);

  state.bullets = state.bullets.filter(
    (bullet) => !spent.has(bullet) && bullet.y > -bullet.r && bullet.x > -bullet.r && bullet.x < state.width + bullet.r,
  );
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0 && enemy.y - enemy.r < state.height);
  state.shots = state.shots.filter(
    (shot) => shot.y > -shot.r && shot.y < state.height + shot.r && shot.x > -shot.r && shot.x < state.width + shot.r,
  );
  state.items = state.items.filter((item) => !picked.includes(item) && item.y - item.r < state.height);
  state.explosions = state.explosions.filter((explosion) => explosion.ageMs < EXPLOSION_MS);

  const cleared = config.boss
    ? state.stageTimeMs >= config.bossSurviveMs
    : state.stageKills >= config.killGoal;
  if (cleared && state.hp > 0) advanceStage(state);
}
