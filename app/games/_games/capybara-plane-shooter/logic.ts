export type WeaponKind = "basic" | "double" | "spread" | "rapid" | "pierce";
export type ItemKind = WeaponKind | "heal";
export type EnemyKind = "straight" | "zigzag" | "shooter" | "shield" | "dasher" | "splitter" | "homing" | "boss";
/** 적이 떨어뜨리는 아이템 (기본총은 시작할 때만 쓴다) */
export type DropKind = Exclude<ItemKind, "basic">;
/** 보스 공격 패턴: 원형 확산 · 돌격 · 격자 · 조준 부채꼴 · 나선 */
export type BossPattern = "ring" | "charge" | "grid" | "fan" | "spiral" | "summon" | "laser" | "guard";
/** 스킬: 방어막(잠깐 무적) · 폭주(무기 레벨 잠깐 +3) · 폭탄(적 탄 제거 + 큰 피해) */
export type SkillKind = "barrier" | "overdrive" | "bomb";

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
  /** 한 발이 깎는 적 체력. 무기 레벨이 오를수록 커진다 */
  damage: number;
  /** 관통탄이 같은 적을 매 프레임 다시 맞히지 않도록 이미 맞힌 적 id를 기억한다 */
  hitIds: number[];
}

export interface Enemy extends Circle {
  id: number;
  kind: EnemyKind;
  hp: number;
  /** 처음 체력. 보스 체력바·페이즈 계산에 쓴다 */
  maxHp: number;
  fireInMs: number;
  /** 맞았을 때 잠깐 하얗게 번쩍이는 시간 */
  flashMs: number;
  /** 종류별 타이머: 칼새는 멈춰서 경고하는 남은 시간, 아르마딜로는 방패를 내린 남은 시간 */
  timerMs: number;
  /** 격추되면 작은 적 둘로 갈라지는지 (독화살개구리만, 갈라진 작은 개구리는 false) */
  split: boolean;
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
  /** 무기 레벨 1~MAX_WEAPON_LEVEL. 어떤 무기 간식이든 먹으면 1 오르고, 맞으면 1 내려간다 */
  weaponLevel: number;
  /** 아이템 없이 격추한 횟수. PITY_KILLS에 닿으면 무기 간식을 반드시 떨어뜨린다 */
  killsSinceDrop: number;
  /** 아르마딜로 방패에 막힌 총알 수 (화면이 막힌 순간에 소리를 내려고 센다) */
  shieldBlocks: number;
  /** 독화살개구리가 갈라진 횟수 */
  splits: number;
  /** 스킬 게이지 0~SKILL_GAUGE_MAX. 격추·보스 피해로 차고, 스킬을 쓰면 비용만큼 준다 */
  skillGauge: number;
  /** 방어막 남은 시간 */
  barrierMs: number;
  /** 폭주 남은 시간 */
  overdriveMs: number;
  /** 폭탄이 터진 뒤 남은 연출 시간 (0보다 커지는 순간이 터진 프레임) */
  bombMs: number;
  fireInMs: number;
  stage: number;
  stageKills: number;
  /** 이번 보스 스테이지의 보스를 격파했는지 (격파한 프레임에 다음 스테이지로 넘어간다) */
  bossDown: boolean;
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
  /** 돌격을 마친 보스가 기절한 남은 시간. 이 동안은 움직이지도 쏘지도 않고 피해를 BOSS_STUN_DAMAGE배로 받는다 */
  bossStunMs: number;
  /** 레이저가 지나가는 x와 휩쓰는 방향 */
  bossLaserX: number;
  bossLaserDir: -1 | 1;
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
  /** 이번 프레임에 쓰려는 스킬. 게이지가 모자라면 나가지 않는다 */
  skill?: SkillKind | null;
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
export const BOSS_PATTERNS: readonly BossPattern[] = ["ring", "charge", "grid", "fan", "spiral", "summon", "laser", "guard"];
/** 패턴 하나를 유지하는 시간 (돌격은 내리꽂고 돌아올 만큼, 레이저는 예고와 휩쓸기가 끝날 만큼) */
export const BOSS_PATTERN_MS: Record<BossPattern, number> = {
  ring: 4000,
  charge: 4200,
  grid: 4500,
  fan: 3500,
  spiral: 4000,
  summon: 4000,
  laser: 3200,
  guard: 4500,
};
export const BOSS_PATTERN_LABELS: Record<BossPattern, string> = {
  ring: "원형 확산",
  charge: "돌격",
  grid: "격자 탄",
  fan: "조준 부채꼴",
  spiral: "나선 탄",
  summon: "부하 소환",
  laser: "레이저",
  guard: "앞 방패",
};
/** 돌격을 마치고 제자리로 돌아온 보스가 기절하는 시간과, 그동안 받는 피해 배수 */
export const BOSS_STUN_MS = 2000;
export const BOSS_STUN_DAMAGE = 3;
export const BOSS_STUN_LABEL = "기절 · 약점 3배";
/** 레이저: 경고선만 긋는 예고 시간, 쏘며 휩쓰는 시간, 빔 반폭(px), 휩쓰는 속도(px/초) */
export const LASER_WINDUP_MS = 900;
export const LASER_BEAM_MS = 1600;
export const LASER_HALF_WIDTH = 13;
export const LASER_SWEEP_SPEED = 220;
/** 앞 방패: 보스 반경 대비 이 비율 안쪽(정면)으로 들어온 총알은 튕겨 나간다 — 옆으로 돌아가 쏴야 한다 */
export const BOSS_GUARD_WIDTH = 0.55;
/** 돌격 전에 경로를 붉게 예고하는 시간 (옆으로 비켜날 여유) */
export const CHARGE_WINDUP_MS = 700;
/** 예고 뒤 비행기 높이까지 내리꽂는 시간 */
export const CHARGE_DASH_MS = 800;
/** 첫 보스(5스테이지) 체력. 뒤 보스일수록 (보스 순번^1.3)배로 늘어 무기 레벨이 쌓인 만큼 버틴다 */
export const BOSS_BASE_HP = 600;
/** 보스 페이즈(1·2·3)별 발사·패턴 간격 배수. 체력이 줄수록 빨라진다 (돌격 예고 시간은 공정하게 그대로 둔다) */
export const BOSS_PHASE_TEMPO = [1, 0.8, 0.6] as const;
/** 보스를 격파하면 무기 레벨을 이만큼 올려 준다 */
export const BOSS_REWARD_LEVELS = 2;
/** 아르마딜로(방패병)가 쏜 뒤 방패를 내리고 있는 시간. 이때만 일반 총알이 들어간다 (관통탄은 늘 뚫는다) */
export const SHIELD_OPEN_MS = 900;
/** 칼새(돌진병)가 멈추는 높이(화면 비율), 붉은 경고선을 보여주는 시간, 내리꽂는 속도(px/초) */
export const DASHER_STOP_RATIO = 0.12;
export const DASHER_WINDUP_MS = 650;
export const DASHER_SPEED = 900;
/** 흡혈박쥐(추적병)가 비행기 쪽으로 방향을 트는 가속도(px/초²)와 옆 속도 상한 */
export const HOMING_ACCEL = 320;
export const HOMING_MAX_VX = 180;
/** 독화살개구리가 갈라질 때 작은 개구리가 양옆으로 튀는 속도(px/초) */
export const SPLIT_SPREAD_SPEED = 110;

export const SKILL_GAUGE_MAX = 100;
/** 일반 적 한 마리를 격추할 때 차는 스킬 게이지 */
export const SKILL_PER_KILL = 4;
/** 보스 최대 체력만큼 피해를 주면 차는 스킬 게이지 (보스 하나를 다 깎으면 게이지 1.5칸) */
export const SKILL_PER_BOSS_FILL = 150;
/** 스킬별 이름·게이지 비용·지속 시간(폭탄은 연출 시간) */
export const SKILLS: Record<SkillKind, { label: string; cost: number; ms: number }> = {
  barrier: { label: "방어막", cost: 50, ms: 3000 },
  overdrive: { label: "폭주", cost: 70, ms: 5000 },
  bomb: { label: "폭탄", cost: 100, ms: 600 },
};
/** 폭주 동안 무기 레벨에 더하는 값 (최대 레벨은 넘지 않는다) */
export const OVERDRIVE_LEVELS = 3;
/** 방어막 반경. 닿는 적 탄은 사라지고 들이받은 일반 적은 부서진다 */
export const BARRIER_RADIUS = 34;
/** 폭탄이 일반 적에게 주는 피해 (방패도 무시한다) */
export const BOMB_DAMAGE = 40;
/** 폭탄이 보스에게 주는 피해 = 보스 최대 체력 × 이 비율 */
export const BOMB_BOSS_RATIO = 0.08;

/** 적 종류별 크기(반경 px)와 스테이지 기준 속도·체력에 곱하는 배수 */
const ENEMY_TRAITS: Record<Exclude<EnemyKind, "boss">, { r: number; speed: number; hp: number }> = {
  straight: { r: 15, speed: 1, hp: 1 },
  zigzag: { r: 15, speed: 1, hp: 1 },
  shooter: { r: 18, speed: 0.45, hp: 1 },
  shield: { r: 18, speed: 0.35, hp: 2 },
  dasher: { r: 13, speed: 1.1, hp: 0.5 },
  splitter: { r: 17, speed: 0.6, hp: 1.5 },
  homing: { r: 12, speed: 0.7, hp: 0.6 },
};
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

/** 1레벨 발사 간격. 레벨이 오를수록 짧아진다 (getWeaponSpec) */
export const FIRE_INTERVAL_MS: Record<WeaponKind, number> = {
  basic: 120,
  double: 130,
  spread: 180,
  rapid: 60,
  pierce: 150,
};

/** 1레벨 총알 반경. 관통탄만 레벨이 오를수록 굵어진다 */
export const BULLET_RADIUS: Record<WeaponKind, number> = {
  basic: 3,
  double: 3,
  spread: 3,
  rapid: 3,
  pierce: 5,
};

export const MAX_WEAPON_LEVEL = 10;
/** 1레벨 발사 간격 배수. 레벨이 오를수록 1로 줄어 10레벨은 원래 연사 — 시작 총은 살살 쏘고 간식을 먹어 가며 강해진다 */
export const LOW_LEVEL_FIRE_SLOWDOWN = 2.5;
/** 화면에 내 총알이 이보다 많으면 이번 발사는 건너뛴다 — 고레벨 연사로 프레임이 무너지지 않게 */
export const MAX_BULLETS = 240;
/** 화면에 적 탄이 이보다 많으면 적·보스가 이번 발사를 건너뛴다 — 후반 탄막으로 프레임이 무너지지 않게 */
export const MAX_SHOTS = 500;
/** 쏘는 적이 여러 발을 부채꼴로 쏠 때 탄 사이 각(라디안) */
export const ENEMY_SHOT_SPREAD = 0.18;
/** 화면에 적이 이만큼 있으면 보스가 부하를 더 부르지 않는다 */
export const MAX_ENEMIES = 30;
/** 아이템 없이 이만큼 격추하면 다음 격추에서 무기 간식을 반드시 떨어뜨린다 (운이 나빠도 레벨을 쌓을 수 있게) */
export const PITY_KILLS = 20;
/** 반드시 떨어뜨릴 때 고르는 무기 간식 */
export const WEAPON_DROPS: readonly Exclude<DropKind, "heal">[] = ["double", "spread", "rapid", "pierce"];

export interface WeaponSpec {
  /** 한 번에 나가는 총알들: 비행기 가운데서 옆으로 벌어진 거리(px)와 기울기(라디안, 0 = 똑바로 위) */
  pattern: readonly { dx: number; angle: number }[];
  damage: number;
  intervalMs: number;
  radius: number;
}

/** count개를 gap 간격으로 가운데 맞춰 벌린 값 */
function fan(count: number, gap: number) {
  return Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * gap);
}

/** 무기 레벨(1~MAX_WEAPON_LEVEL) → 한 번 발사하는 모양. 레벨이 오를수록 탄 줄·피해·연사가 늘어 10레벨이면 화면을 덮을 만큼 쏜다 */
export function getWeaponSpec(weapon: WeaponKind, level: number): WeaponSpec {
  const step = Math.min(MAX_WEAPON_LEVEL, Math.max(1, Math.round(level))) - 1;
  const slowdown = 1 + (LOW_LEVEL_FIRE_SLOWDOWN - 1) * (1 - step / (MAX_WEAPON_LEVEL - 1));
  const faster = (perLevel: number) => FIRE_INTERVAL_MS[weapon] * (1 - perLevel * step) * slowdown;
  const straight = (count: number, gap: number) => fan(count, gap).map((dx) => ({ dx, angle: 0 }));

  switch (weapon) {
    case "double": {
      // 나란히 두 줄에서 시작해 3레벨마다 바깥에 조금 벌어진 한 쌍을 더한다 (최대 4쌍)
      const pairs = 1 + Math.floor(step / 3);
      const pattern = Array.from({ length: pairs }, (_, index) => [
        { dx: -7 - index * 9, angle: -index * 0.06 },
        { dx: 7 + index * 9, angle: index * 0.06 },
      ]).flat();
      return { pattern, damage: 1 + Math.floor(step / 4), intervalMs: faster(0.03), radius: BULLET_RADIUS.double };
    }
    case "spread": {
      // 3갈래에서 2레벨마다 2갈래씩 늘어 11갈래까지. 부채꼴 전체 폭은 넘지 않게 사이 각을 좁힌다
      const count = 3 + 2 * Math.floor(step / 2);
      const gap = Math.min(0.22, 1.1 / (count - 1));
      const pattern = fan(count, gap).map((angle) => ({ dx: 0, angle }));
      return { pattern, damage: 1 + Math.floor(step / 5), intervalMs: faster(0.03), radius: BULLET_RADIUS.spread };
    }
    case "rapid":
      // 가장 빨리 쏘는 무기: 3레벨마다 한 줄씩 늘고(최대 4줄), 간격이 가장 크게 줄어든다
      return { pattern: straight(1 + Math.floor(step / 3), 8), damage: 1 + Math.floor(step / 5), intervalMs: faster(0.04), radius: BULLET_RADIUS.rapid };
    case "pierce":
      // 뚫고 지나가는 굵은 탄: 줄은 적게(최대 3줄) 늘고 대신 피해와 굵기가 크게 오른다
      return {
        pattern: straight(1 + Math.floor(step / 4), 14),
        damage: 1 + Math.floor(step / 3),
        intervalMs: faster(0.03),
        radius: BULLET_RADIUS.pierce + step * 0.45,
      };
    default:
      // 풀잎탄: 2레벨마다 한 줄씩 늘어 5줄까지
      return { pattern: straight(1 + Math.floor(step / 2), 9), damage: 1 + Math.floor(step / 4), intervalMs: faster(0.03), radius: BULLET_RADIUS.basic };
  }
}

/**
 * 적 한 마리를 격추할 때 아이템 종류별로 떨어질 확률 (합계 5.5%).
 * 무기 간식은 먹을 때마다 레벨이 쌓이므로 드물게 떨어뜨려 천천히 강해지게 하고, 쌍발 < 산탄 < 연사 < 관통 순으로 강한 무기일수록 더 드물다
 */
export const DROP_CHANCES: Record<DropKind, number> = {
  double: 0.015,
  heal: 0.01,
  spread: 0.0125,
  rapid: 0.01,
  pierce: 0.0075,
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

/** 이 스테이지에서 적 구성·체력 곡선이 끝나고, 그 뒤로는 러시 — 속도가 끝없이 오른다 */
export const PEAK_STAGE = 40;
/** 러시 구간에서 스테이지마다 적·탄 속도에 더해지는 배율 (65스테이지면 2.5배) */
export const RUSH_PER_STAGE = 0.06;
/** 러시로 간격이 줄어도 이 아래로는 안 내려간다 (화면이 탄으로 뒤덮여 버벅이지 않게, 적 탄은 MAX_SHOTS 상한도 있다) */
export const MIN_SPAWN_INTERVAL_MS = 120;
export const MIN_ENEMY_FIRE_INTERVAL_MS = 250;

/** PEAK_STAGE까지 1, 그 뒤로 스테이지마다 RUSH_PER_STAGE씩 커진다 */
export function getRush(stage: number) {
  return 1 + Math.max(0, stage - PEAK_STAGE) * RUSH_PER_STAGE;
}

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
 * PEAK_STAGE 뒤로는 러시 배율만큼 적·탄이 계속 빨라지고 출현·사격 간격이 짧아진다 (간격은 하한까지만)
 */
export function getStageConfig(stage: number) {
  const boss = isBossStage(stage);
  const d = getDifficulty(stage);
  const rush = getRush(stage);
  return {
    boss,
    killGoal: Math.round(lerp(10, 50, d)),
    bossHp: Math.round(BOSS_BASE_HP * (stage / BOSS_STAGE_EVERY) ** 1.3),
    spawnIntervalMs: Math.max(MIN_SPAWN_INTERVAL_MS, lerp(750, 200, d) / rush) * (boss ? 2.5 : 1),
    // 무기 레벨·스킬로 내가 강해지는 만큼 적도 훨씬 단단해진다 (10스테이지 ≈5, 20 ≈16, 30 ≈35, 40 이후 60)
    enemyHp: Math.round(lerp(2, 60, d)),
    enemySpeed: lerp(100, 360, d) * rush,
    // 새 천적은 스테이지가 오를 때마다 하나씩 합류한다. 확률 합은 최고 난이도에서도 0.9를 넘지 않아 하피독수리가 늘 섞인다
    zigzagChance: stage >= 2 ? 0.2 : 0,
    shooterChance: stage >= 3 ? lerp(0.1, 0.25, d) : 0,
    dasherChance: stage >= 4 ? lerp(0.08, 0.12, d) : 0,
    shieldChance: stage >= 6 ? lerp(0.06, 0.12, d) : 0,
    splitterChance: stage >= 7 ? lerp(0.06, 0.1, d) : 0,
    homingChance: stage >= 8 ? lerp(0.05, 0.1, d) : 0,
    enemyFireIntervalMs: Math.max(MIN_ENEMY_FIRE_INTERVAL_MS, lerp(2000, 380, d) / rush),
    // 최고 난이도까지는 탄 수를 늘려 탄막을 두껍게 하고, 그 뒤로는 러시 배율만큼 탄도 빨라진다
    shotSpeed: lerp(160, 420, d) * rush,
    enemyShotCount: Math.round(lerp(1, 5, d)),
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
    weaponLevel: 1,
    killsSinceDrop: 0,
    shieldBlocks: 0,
    splits: 0,
    skillGauge: 0,
    barrierMs: 0,
    overdriveMs: 0,
    bombMs: 0,
    fireInMs: 0,
    stage: 1,
    stageKills: 0,
    bossDown: false,
    bannerMs: STAGE_BANNER_MS,
    score: 0,
    spawnInMs: 0,
    nextId: 1,
    bossAngle: 0,
    bossPatternIndex: 0,
    bossPatternMs: 0,
    bossChargeX: width / 2,
    bossGridRow: 0,
    bossStunMs: 0,
    bossLaserX: width / 2,
    bossLaserDir: 1,
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

/** 보스 체력 비율로 나눈 페이즈: 2/3 초과 1, 1/3 초과 2, 그 아래 3 */
export function getBossPhase(boss: Pick<Enemy, "hp" | "maxHp">): 1 | 2 | 3 {
  const ratio = boss.hp / boss.maxHp;
  return ratio > 2 / 3 ? 1 : ratio > 1 / 3 ? 2 : 3;
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

/** 지금 무기·레벨 모양대로 한 번 쏘고, 다음 발사까지의 간격을 돌려준다 */
export function fireWeapon(state: GameState) {
  const spec = getWeaponSpec(state.weapon, getFireLevel(state));
  const x = state.planeX;
  const y = getPlaneY(state) - 22;
  for (const { dx, angle } of spec.pattern) {
    state.bullets.push({
      x: x + dx,
      y,
      r: spec.radius,
      vx: Math.sin(angle) * BULLET_SPEED,
      vy: -Math.cos(angle) * BULLET_SPEED,
      weapon: state.weapon,
      damage: spec.damage,
      hitIds: [],
    });
  }
  return spec.intervalMs;
}

export function spawnEnemy(state: GameState, random: () => number = Math.random): Enemy {
  const config = getStageConfig(state.stage);
  // 한 번 굴린 값이 어느 종류 확률 구간에 들어가느냐로 정하고, 어디에도 안 들어가면 기본 하피독수리
  let roll = random();
  let kind: Exclude<EnemyKind, "boss"> = "straight";
  for (const [candidate, chance] of [
    ["shooter", config.shooterChance],
    ["zigzag", config.zigzagChance],
    ["dasher", config.dasherChance],
    ["shield", config.shieldChance],
    ["splitter", config.splitterChance],
    ["homing", config.homingChance],
  ] as const) {
    if (roll < chance) {
      kind = candidate;
      break;
    }
    roll -= chance;
  }
  const { r, speed: speedRatio, hp: hpRatio } = ENEMY_TRAITS[kind];
  const speed = config.enemySpeed * speedRatio;
  const hp = Math.max(1, Math.round(config.enemyHp * hpRatio));
  return {
    id: state.nextId++,
    kind,
    x: r + random() * (state.width - r * 2),
    y: -r,
    r,
    vx: kind === "zigzag" ? (random() < 0.5 ? -1 : 1) * speed * 0.7 : 0,
    vy: speed,
    hp,
    maxHp: hp,
    fireInMs: config.enemyFireIntervalMs * random(),
    flashMs: 0,
    timerMs: kind === "dasher" ? DASHER_WINDUP_MS : 0,
    split: kind === "splitter",
  };
}

/** 방패를 들고 있어 일반 총알을 막는 중인지 (아르마딜로가 쏜 직후 SHIELD_OPEN_MS 동안만 내린다) */
export function isShieldUp(enemy: Pick<Enemy, "kind" | "timerMs">) {
  return enemy.kind === "shield" && enemy.timerMs <= 0;
}

/** 독화살개구리가 격추되면 작은 개구리 둘로 갈라진다. 작은 개구리는 더 갈라지지 않는다 */
function splitEnemy(state: GameState, parent: Enemy): Enemy[] {
  state.splits += 1;
  const r = Math.round(parent.r * 0.65);
  const hp = Math.max(1, Math.ceil(parent.maxHp / 2));
  return [-1, 1].map(
    (side): Enemy => ({
      id: state.nextId++,
      kind: "splitter",
      x: parent.x + side * r,
      y: parent.y,
      r,
      vx: side * SPLIT_SPREAD_SPEED,
      vy: Math.abs(parent.vy) + 40,
      hp,
      maxHp: hp,
      fireInMs: 0,
      flashMs: 0,
      timerMs: 0,
      split: false,
    }),
  );
}

function spawnBoss(state: GameState): Enemy {
  const hp = getStageConfig(state.stage).bossHp;
  // 보스마다 시작 패턴을 한 칸씩 밀어 매번 다른 순서로 시작한다
  state.bossPatternIndex = state.stage / BOSS_STAGE_EVERY - 1;
  state.bossPatternMs = 0;
  state.bossGridRow = 0;
  state.bossStunMs = 0;
  return {
    id: state.nextId++,
    kind: "boss",
    x: state.width / 2,
    y: -BOSS_RADIUS,
    r: BOSS_RADIUS,
    vx: 80 + state.stage * 4,
    vy: 70,
    hp,
    maxHp: hp,
    fireInMs: 600,
    flashMs: 0,
    timerMs: 0,
    split: false,
  };
}

export function getBossPattern(state: Pick<GameState, "bossPatternIndex">): BossPattern {
  return BOSS_PATTERNS[state.bossPatternIndex % BOSS_PATTERNS.length];
}

/** 레이저 빔이 지금 켜져 있는지 (예고가 끝나고 휩쓰는 동안) */
export function isLaserActive(state: GameState) {
  const t = state.bossPatternMs;
  return (
    getBossPattern(state) === "laser" &&
    state.bossStunMs <= 0 &&
    t >= LASER_WINDUP_MS &&
    t < LASER_WINDUP_MS + LASER_BEAM_MS &&
    state.enemies.some((enemy) => enemy.kind === "boss")
  );
}

/** 보스가 앞 방패를 들고 정면 총알을 튕겨내는 중인지 */
export function isBossGuarding(state: GameState) {
  return getBossPattern(state) === "guard" && state.bossStunMs <= 0 && state.enemies.some((enemy) => enemy.kind === "boss");
}

export function getBossHomeY(state: Pick<GameState, "height">) {
  return state.height * BOSS_Y_RATIO;
}

/** 탄을 쏘는 패턴의 한 번 발사. 다음 발사까지의 간격을 돌려준다 */
function fireBoss(
  state: GameState,
  boss: Enemy,
  pattern: Exclude<BossPattern, "charge" | "laser">,
  random: () => number,
): number {
  const d = getDifficulty(state.stage);
  const speed = getStageConfig(state.stage).shotSpeed;
  // 화면에 탄이 너무 많으면 이번 발사는 건너뛰고 잠깐 뒤에 다시 쏜다
  if (state.shots.length >= MAX_SHOTS) return 300;

  // 어려운 쪽 값도 비행기 근처 탄 사이 틈이 비행기 피격 폭보다 넉넉히 남는 선에서 멈춘다
  switch (pattern) {
    case "ring": {
      // 보스 한가운데서 원형으로 퍼진다. 링마다 반 칸씩 돌려 틈 위치가 바뀐다
      const count = Math.round(lerp(12, 44, d));
      state.bossAngle += Math.PI / count;
      for (let i = 0; i < count; i += 1) {
        state.shots.push(radialShot(boss.x, boss.y, (i / count) * Math.PI * 2 + state.bossAngle, speed * 0.85));
      }
      return lerp(1300, 650, d);
    }
    case "grid": {
      // 화면 위에서 격자 모양 탄 줄이 내려온다. 줄마다 반 칸 어긋나고, 두 칸짜리 빈틈이 하나 있다
      const spacing = lerp(90, 54, d);
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
      const half = Math.round(lerp(1, 5, d));
      for (let i = -half; i <= half; i += 1) {
        state.shots.push(aimedShot(state, boss.x, boss.y + boss.r * 0.6, speed * 1.1, i * 0.16));
      }
      return lerp(1100, 450, d);
    }
    case "spiral": {
      const arms = Math.round(lerp(3, 6, d));
      for (let arm = 0; arm < arms; arm += 1) {
        state.shots.push(radialShot(boss.x, boss.y, state.bossAngle + (arm * Math.PI * 2) / arms, speed));
      }
      state.bossAngle += 0.35;
      return lerp(170, 80, d);
    }
    case "summon": {
      // 보스 좌우에서 말벌 부하를 하나씩 내보낸다. 적이 이미 많으면 이번에는 쉰다
      if (state.enemies.length < MAX_ENEMIES) {
        const config = getStageConfig(state.stage);
        for (const side of [-1, 1] as const) {
          state.enemies.push({
            id: state.nextId++,
            kind: "zigzag",
            x: Math.min(state.width - 15, Math.max(15, boss.x + side * boss.r)),
            y: boss.y + boss.r * 0.5,
            r: 15,
            vx: side * config.enemySpeed * 0.7,
            vy: config.enemySpeed * 0.8,
            hp: config.enemyHp,
            maxHp: config.enemyHp,
            fireInMs: 0,
            flashMs: 0,
            timerMs: 0,
            split: false,
          });
        }
      }
      return lerp(1600, 900, d);
    }
    case "guard":
      // 앞 방패를 든 채 비행기를 겨눈 세 발을 느리게 쏜다
      for (const offset of fan(3, 0.25)) {
        state.shots.push(aimedShot(state, boss.x, boss.y + boss.r * 0.6, speed * 0.9, offset));
      }
      return lerp(1500, 800, d);
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

  // 돌격 뒤 기절: 제자리에 멈춰 움직이지도 쏘지도 않는다 (이때 맞으면 피해가 커진다)
  if (state.bossStunMs > 0) {
    state.bossStunMs = Math.max(0, state.bossStunMs - dt);
    return;
  }

  const pattern = getBossPattern(state);
  const tempo = BOSS_PHASE_TEMPO[getBossPhase(boss) - 1];
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
  } else if (pattern === "laser") {
    const t = state.bossPatternMs;
    if (t < LASER_WINDUP_MS) {
      // 예고하는 동안 보스 앞에 경고선을 긋고, 비행기가 있는 쪽으로 휩쓸 방향을 정한다
      state.bossLaserX = boss.x;
      state.bossLaserDir = state.planeX >= boss.x ? 1 : -1;
    } else if (t < LASER_WINDUP_MS + LASER_BEAM_MS) {
      const next = state.bossLaserX + state.bossLaserDir * LASER_SWEEP_SPEED * seconds;
      state.bossLaserX = Math.min(state.width - LASER_HALF_WIDTH, Math.max(LASER_HALF_WIDTH, next));
    }
  } else {
    // 좌우로 오가며 쏜다. 페이즈가 오를수록 빨리 움직인다
    boss.x += (boss.vx * seconds) / tempo;
    if (boss.x < boss.r || boss.x > state.width - boss.r) {
      boss.vx = -boss.vx;
      boss.x = Math.min(state.width - boss.r, Math.max(boss.r, boss.x));
    }
    boss.fireInMs -= dt;
    if (boss.fireInMs <= 0) boss.fireInMs = fireBoss(state, boss, pattern, random) * tempo;
  }

  // 돌격에서 제자리로 돌아온 뒤에야 다음 패턴으로 넘어간다
  // 페이즈가 올라 빨라져도 레이저는 예고와 휩쓸기를 끝까지 보여준다
  const patternMs = Math.max(BOSS_PATTERN_MS[pattern] * tempo, pattern === "laser" ? LASER_WINDUP_MS + LASER_BEAM_MS : 0);
  if (state.bossPatternMs >= patternMs && boss.y <= homeY) {
    state.bossPatternIndex += 1;
    state.bossPatternMs = 0;
    boss.fireInMs = 500;
    // 돌격을 마치고 제자리로 돌아오면 어지러워 잠깐 기절한다 — 약점을 노릴 기회
    if (pattern === "charge") state.bossStunMs = BOSS_STUN_MS;
  }
}

/** 일반 적 한 프레임: 종류별 움직임(칼새 멈춤·돌진, 흡혈박쥐 추적, 아르마딜로 방패) 뒤 이동하고, 쏘는 적은 쏜다 */
function updateEnemy(state: GameState, enemy: Enemy, dt: number, config: ReturnType<typeof getStageConfig>) {
  const seconds = dt / 1000;
  switch (enemy.kind) {
    case "dasher":
      // 정해진 높이에 멈춰 붉은 경고선을 보여준 뒤 곧장 내리꽂는다 (경고 중에는 vy가 0)
      if (enemy.vy === 0) {
        enemy.timerMs -= dt;
        if (enemy.timerMs <= 0) enemy.vy = DASHER_SPEED;
      } else if (enemy.timerMs > 0 && enemy.y >= state.height * DASHER_STOP_RATIO) {
        enemy.vy = 0;
      }
      break;
    case "homing": {
      // 비행기 쪽으로 옆 속도를 조금씩 틀어 따라온다
      const toward = Math.sign(state.planeX - enemy.x);
      enemy.vx = Math.max(-HOMING_MAX_VX, Math.min(HOMING_MAX_VX, enemy.vx + toward * HOMING_ACCEL * seconds));
      break;
    }
    case "shield":
      enemy.timerMs = Math.max(0, enemy.timerMs - dt);
      break;
  }

  moveCircle(enemy, seconds, state.width);
  if ((enemy.kind !== "shooter" && enemy.kind !== "shield") || enemy.y < 0) return;
  enemy.fireInMs -= dt;
  if (enemy.fireInMs > 0) return;
  if (state.shots.length < MAX_SHOTS) {
    // 뒤 스테이지일수록 비행기를 겨눈 부채꼴로 여러 발을 쏜다
    for (const offset of fan(config.enemyShotCount, ENEMY_SHOT_SPREAD)) {
      state.shots.push(aimedShot(state, enemy.x, enemy.y + enemy.r, config.shotSpeed, offset, false));
    }
  }
  if (enemy.kind === "shield") {
    // 아르마딜로는 느리게 쏘고, 쏠 때 방패를 잠깐 내린다 — 그때가 일반 총알로 잡을 기회
    enemy.fireInMs = config.enemyFireIntervalMs * 1.3;
    enemy.timerMs = SHIELD_OPEN_MS;
  } else {
    enemy.fireInMs = config.enemyFireIntervalMs;
  }
}

/** 보스 체력이 0이 되면: 크게 한 번 + 둘레 네 번 터지고, 남은 보스 탄이 사라지며, 무기 레벨을 올려 준다 */
function defeatBoss(state: GameState, boss: Enemy) {
  state.bossDown = true;
  state.weaponLevel = Math.min(MAX_WEAPON_LEVEL, state.weaponLevel + BOSS_REWARD_LEVELS);
  explode(state, boss);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    state.explosions.push({ x: boss.x + dx * boss.r * 0.6, y: boss.y + dy * boss.r * 0.6, size: boss.r * 2, ageMs: 0 });
  }
  state.shots = [];
}

/** 지금 실제로 쏘는 무기 레벨. 폭주 중이면 OVERDRIVE_LEVELS만큼 높다 */
export function getFireLevel(state: Pick<GameState, "weaponLevel" | "overdriveMs">) {
  return Math.min(MAX_WEAPON_LEVEL, state.weaponLevel + (state.overdriveMs > 0 ? OVERDRIVE_LEVELS : 0));
}

function addSkillGauge(state: GameState, amount: number) {
  state.skillGauge = Math.min(SKILL_GAUGE_MAX, state.skillGauge + amount);
}

/** 일반 적 격추: 점수·폭발·스킬 게이지·아이템(보장 드롭 포함). 독화살개구리가 갈라져 생긴 작은 적을 돌려준다 */
function destroyEnemy(state: GameState, enemy: Enemy, random: () => number): Enemy[] {
  state.score += KILL_SCORE;
  state.stageKills += 1;
  addSkillGauge(state, SKILL_PER_KILL);
  explode(state, enemy);
  const children = enemy.split ? splitEnemy(state, enemy) : [];
  const pity = state.killsSinceDrop + 1 >= PITY_KILLS;
  const kind = pickDrop(random) ?? (pity ? WEAPON_DROPS[Math.floor(random() * WEAPON_DROPS.length)] : null);
  if (kind) {
    state.items.push({ kind, x: enemy.x, y: enemy.y, r: ITEM_RADIUS, vx: 60, vy: 90 });
    state.killsSinceDrop = 0;
  } else {
    state.killsSinceDrop += 1;
  }
  return children;
}

/** 보스에게 피해를 주고 준 만큼 스킬 게이지를 채운다. 체력이 0이 되면 격파 */
function damageBoss(state: GameState, boss: Enemy, damage: number) {
  // 기절한 동안은 약점이 드러나 피해가 BOSS_STUN_DAMAGE배
  const dealt = state.bossStunMs > 0 ? damage * BOSS_STUN_DAMAGE : damage;
  boss.hp -= dealt;
  addSkillGauge(state, (dealt / boss.maxHp) * SKILL_PER_BOSS_FILL);
  if (boss.hp <= 0) defeatBoss(state, boss);
}

/** 폭탄: 화면의 적 탄을 모두 지우고, 일반 적(방패 무시)에게 큰 피해, 보스에게는 최대 체력 비율 피해 */
function detonateBomb(state: GameState, random: () => number) {
  state.bombMs = SKILLS.bomb.ms;
  state.shots = [];
  const spawned: Enemy[] = [];
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.flashMs = 80;
    if (enemy.kind === "boss") {
      damageBoss(state, enemy, Math.ceil(enemy.maxHp * BOMB_BOSS_RATIO));
      continue;
    }
    enemy.hp -= BOMB_DAMAGE;
    if (enemy.hp <= 0) spawned.push(...destroyEnemy(state, enemy, random));
  }
  state.enemies.push(...spawned);
}

/** 게이지가 비용만큼 있으면 스킬을 쓴다. 쓰면 true */
export function castSkill(state: GameState, kind: SkillKind, random: () => number = Math.random) {
  const { cost, ms } = SKILLS[kind];
  if (state.skillGauge < cost) return false;
  state.skillGauge -= cost;
  if (kind === "barrier") state.barrierMs = ms;
  else if (kind === "overdrive") state.overdriveMs = ms;
  else detonateBomb(state, random);
  return true;
}

function applyItem(state: GameState, kind: DropKind) {
  if (kind === "heal") {
    state.hp = Math.min(MAX_HP, state.hp + 1);
  } else {
    // 어떤 무기 간식이든 레벨은 하나로 쌓이고, 무기 종류는 방금 먹은 것으로 바뀐다
    state.weapon = kind;
    state.weaponLevel = Math.min(MAX_WEAPON_LEVEL, state.weaponLevel + 1);
  }
  state.score += 50;
}

function damagePlane(state: GameState) {
  state.hp -= 1;
  state.invincibleMs = INVINCIBLE_MS;
  // 맞으면 무기 레벨이 하나 내려간다 — 강해져도 긴장을 놓지 않게
  state.weaponLevel = Math.max(1, state.weaponLevel - 1);
}

function advanceStage(state: GameState) {
  state.score += getStageConfig(state.stage).boss ? BOSS_CLEAR_SCORE : STAGE_CLEAR_SCORE;
  state.stage += 1;
  state.stageKills = 0;
  state.bossDown = false;
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
  state.barrierMs = Math.max(0, state.barrierMs - dt);
  state.overdriveMs = Math.max(0, state.overdriveMs - dt);
  state.bombMs = Math.max(0, state.bombMs - dt);

  const movedX =
    input.targetX !== null ? input.targetX : state.planeX + input.direction * PLANE_SPEED * seconds;
  const prevX = state.planeX;
  state.planeX = Math.min(state.width - PLANE_HALF_WIDTH, Math.max(PLANE_HALF_WIDTH, movedX));
  const movedBy = state.planeX - prevX;
  state.bank = Math.abs(movedBy) < 0.5 ? 0 : movedBy < 0 ? -1 : 1;

  // 스킬은 쏘기 전에 써서 폭주가 이번 발사부터 바로 반영된다
  if (input.skill) castSkill(state, input.skill, random);

  // 총은 항상 자동으로 나간다. 화면에 탄이 너무 많으면 이번 발사만 건너뛰고 간격은 그대로 센다
  state.fireInMs -= dt;
  if (state.fireInMs <= 0) {
    state.fireInMs +=
      state.bullets.length < MAX_BULLETS ? fireWeapon(state) : getWeaponSpec(state.weapon, getFireLevel(state)).intervalMs;
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

    updateEnemy(state, enemy, dt, config);
  }

  if (state.bannerMs <= 0) {
    if (config.boss && !state.enemies.some((enemy) => enemy.kind === "boss")) {
      state.enemies.push(spawnBoss(state));
    }
    state.spawnInMs -= dt;
    if (state.spawnInMs <= 0) {
      state.enemies.push(spawnEnemy(state, random));
      state.spawnInMs = config.spawnIntervalMs;
    }
  }

  // 내 총알 → 적. 보스도 맞으면 체력이 깎이고 0이 되면 격파된다
  const spent = new Set<Bullet>();
  const guarding = isBossGuarding(state);
  /** 독화살개구리가 갈라져 생긴 적. 도는 중인 목록에 바로 넣으면 같은 총알에 곧바로 맞으므로 다 돈 뒤에 넣는다 */
  const spawned: Enemy[] = [];
  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || bullet.hitIds.includes(enemy.id) || !overlaps(bullet, enemy)) continue;
      // 방패를 든 아르마딜로는 관통탄이 아니면 막아낸다 (총알만 사라지고 체력은 그대로)
      if (isShieldUp(enemy) && bullet.weapon !== "pierce") {
        spent.add(bullet);
        state.shieldBlocks += 1;
        break;
      }
      enemy.flashMs = 80;
      if (enemy.kind === "boss") {
        // 보스는 관통탄도 뚫지 못한다. 앞 방패를 든 동안 정면으로 온 총알은 튕겨 나가고 옆에서 맞힌 것만 들어간다
        spent.add(bullet);
        if (guarding && Math.abs(bullet.x - enemy.x) < enemy.r * BOSS_GUARD_WIDTH) {
          state.shieldBlocks += 1;
          break;
        }
        damageBoss(state, enemy, bullet.damage);
        break;
      }
      enemy.hp -= bullet.damage;
      if (enemy.hp <= 0) spawned.push(...destroyEnemy(state, enemy, random));
      if (bullet.weapon !== "pierce") {
        spent.add(bullet);
        break;
      }
      bullet.hitIds.push(enemy.id);
    }
  }

  state.enemies.push(...spawned);

  const plane: Circle = { x: state.planeX, y: planeY, r: PLANE_HIT_RADIUS, vx: 0, vy: 0 };
  if (state.barrierMs > 0) {
    // 방어막은 닿는 적 탄을 지우고, 들이받은 일반 적은 같이 부순다 (비행기는 다치지 않는다)
    state.shots = state.shots.filter((shot) => !overlaps(shot, plane, BARRIER_RADIUS + shot.r));
    for (const enemy of state.enemies) {
      if (enemy.kind === "boss" || enemy.hp <= 0 || !overlaps(enemy, plane, BARRIER_RADIUS + enemy.r)) continue;
      enemy.hp = 0;
      explode(state, enemy);
    }
  } else if (state.invincibleMs <= 0) {
    const rammed = state.enemies.find((enemy) => enemy.hp > 0 && overlaps(enemy, plane));
    const shot = state.shots.find((candidate) => overlaps(candidate, plane));
    const lasered = isLaserActive(state) && Math.abs(state.planeX - state.bossLaserX) < LASER_HALF_WIDTH + PLANE_HIT_RADIUS;
    if (rammed || shot || lasered) {
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

  const cleared = config.boss ? state.bossDown : state.stageKills >= config.killGoal;
  if (cleared && state.hp > 0) advanceStage(state);
}
