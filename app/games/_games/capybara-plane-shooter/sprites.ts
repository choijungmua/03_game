import { BOSS_STAGE_EVERY, type DropKind, type EnemyKind, type WeaponKind } from "./logic";

// 원본 SVG와 생성 스크립트: assets-src/games/capybara-plane-shooter/build-sprites.mjs
const BASE = "/assets/images/games/capybara-plane-shooter";

/** 게임에서 쓰는 이미지 전부. 파일 하나는 한 가지 용도에만 쓴다 (sprites.test.ts가 검사) */
export const SPRITES = {
  plane: `${BASE}/plane/plane.webp`,
  planeBankLeft: `${BASE}/plane/plane-bank-left.webp`,
  planeBankRight: `${BASE}/plane/plane-bank-right.webp`,
  planeHurt: `${BASE}/plane/plane-hurt.webp`,
  planeFlame1: `${BASE}/plane/flame-1.webp`,
  planeFlame2: `${BASE}/plane/flame-2.webp`,
  enemyStraight: `${BASE}/enemy/straight.webp`,
  enemyStraightHit: `${BASE}/enemy/straight-hit.webp`,
  enemyZigzag: `${BASE}/enemy/zigzag.webp`,
  enemyZigzagHit: `${BASE}/enemy/zigzag-hit.webp`,
  enemyShooter: `${BASE}/enemy/shooter.webp`,
  enemyShooterHit: `${BASE}/enemy/shooter-hit.webp`,
  boss: `${BASE}/enemy/boss.webp`,
  bossHit: `${BASE}/enemy/boss-hit.webp`,
  itemDouble: `${BASE}/item/double.webp`,
  itemSpread: `${BASE}/item/spread.webp`,
  itemRapid: `${BASE}/item/rapid.webp`,
  itemPierce: `${BASE}/item/pierce.webp`,
  itemHeal: `${BASE}/item/heal.webp`,
  bulletBasic: `${BASE}/bullet/basic.webp`,
  bulletDouble: `${BASE}/bullet/double.webp`,
  bulletSpread: `${BASE}/bullet/spread.webp`,
  bulletRapid: `${BASE}/bullet/rapid.webp`,
  bulletPierce: `${BASE}/bullet/pierce.webp`,
  shotEnemy: `${BASE}/bullet/enemy-shot.webp`,
  shotBoss: `${BASE}/bullet/boss-shot.webp`,
  explosion1: `${BASE}/effect/explosion-1.webp`,
  explosion2: `${BASE}/effect/explosion-2.webp`,
  explosion3: `${BASE}/effect/explosion-3.webp`,
  explosion4: `${BASE}/effect/explosion-4.webp`,
  bgSwampMorning: `${BASE}/background/swamp-morning.webp`,
  bgRiverSunset: `${BASE}/background/river-sunset.webp`,
  bgOnsenNight: `${BASE}/background/onsen-night.webp`,
  capybaraHero: `${BASE}/capybara/hero.webp`,
  capybaraStageBanner: `${BASE}/capybara/banner-stage.webp`,
  capybaraBossBanner: `${BASE}/capybara/banner-boss.webp`,
  capybaraTierLegend: `${BASE}/capybara/tier-legend.webp`,
  capybaraTierAce: `${BASE}/capybara/tier-ace.webp`,
  capybaraTierVeteran: `${BASE}/capybara/tier-veteran.webp`,
  capybaraTierPilot: `${BASE}/capybara/tier-pilot.webp`,
  capybaraTierTrainee: `${BASE}/capybara/tier-trainee.webp`,
} as const;

export type SpriteKey = keyof typeof SPRITES;
export type SpriteImages = Record<SpriteKey, HTMLImageElement>;

/** 비행기는 움직이는 방향으로 기운 그림을 쓰고, 맞은 뒤 무적 시간에는 어지러워하는 조종사 그림을 쓴다 */
export const PLANE_SPRITES = {
  left: "planeBankLeft",
  center: "plane",
  right: "planeBankRight",
  hurt: "planeHurt",
} as const satisfies Record<string, SpriteKey>;

/** 화면 곳곳의 카피바라: 시작 화면 조종사, 일반 스테이지 배너(경례), 보스 스테이지 배너(헬멧) */
export const CAPYBARA_SPRITES = {
  hero: "capybaraHero",
  stageBanner: "capybaraStageBanner",
  bossBanner: "capybaraBossBanner",
} as const satisfies Record<string, SpriteKey>;

/** 결과 화면의 등급별 카피바라. PLANE_SHOOTER_TIERS와 같은 순서 (전설 → 훈련생) */
export const TIER_SPRITES: readonly SpriteKey[] = [
  "capybaraTierLegend",
  "capybaraTierAce",
  "capybaraTierVeteran",
  "capybaraTierPilot",
  "capybaraTierTrainee",
];

/** 엔진 불꽃은 두 프레임을 번갈아 보여준다 */
export const FLAME_FRAMES: readonly SpriteKey[] = ["planeFlame1", "planeFlame2"];

/** 카피바라의 천적들: 직선 = 하피독수리, 지그재그 = 말벌, 조준 사격 = 재규어, 보스 = 카이만 */
export const ENEMY_SPRITES: Record<EnemyKind, { normal: SpriteKey; hit: SpriteKey }> = {
  straight: { normal: "enemyStraight", hit: "enemyStraightHit" },
  zigzag: { normal: "enemyZigzag", hit: "enemyZigzagHit" },
  shooter: { normal: "enemyShooter", hit: "enemyShooterHit" },
  boss: { normal: "boss", hit: "bossHit" },
};

/** 카피바라 간식 아이템: 해바라기씨·귤·옥수수·사탕수수·유자 온천 */
export const ITEM_SPRITES: Record<DropKind, SpriteKey> = {
  double: "itemDouble",
  spread: "itemSpread",
  rapid: "itemRapid",
  pierce: "itemPierce",
  heal: "itemHeal",
};

/** 총알은 무기마다 그림과 게임 안 크기(px)가 다르다 */
export const BULLET_SPRITES: Record<WeaponKind, { sprite: SpriteKey; width: number; height: number }> = {
  basic: { sprite: "bulletBasic", width: 4, height: 16 },
  double: { sprite: "bulletDouble", width: 4, height: 16 },
  spread: { sprite: "bulletSpread", width: 8, height: 8 },
  rapid: { sprite: "bulletRapid", width: 3, height: 15 },
  pierce: { sprite: "bulletPierce", width: 7, height: 22 },
};

export const SHOT_SPRITES = { enemy: "shotEnemy", boss: "shotBoss" } as const satisfies Record<string, SpriteKey>;

/** 격추 효과("펑" 연기와 깃털·잎) 4프레임, EXPLOSION_MS 동안 순서대로 재생한다 */
export const EXPLOSION_FRAMES: readonly SpriteKey[] = ["explosion1", "explosion2", "explosion3", "explosion4"];

/** 보스를 넘길 때마다 아침 늪 → 노을 강 → 밤 온천 순서로 배경이 바뀐다 */
export const BACKGROUND_SPRITES: readonly SpriteKey[] = ["bgSwampMorning", "bgRiverSunset", "bgOnsenNight"];

/** 이 스테이지의 배경. 캔버스 배경과, 넓은 화면에서 플레이 영역 바깥을 흐리게 채우는 배경이 같은 그림을 쓴다 */
export function getBackgroundSpriteKey(stage: number): SpriteKey {
  return BACKGROUND_SPRITES[Math.floor((stage - 1) / BOSS_STAGE_EVERY) % BACKGROUND_SPRITES.length];
}

let loading: Promise<SpriteImages> | null = null;

/** 한 번만 불러와 캐시한다. 실패한 이미지가 있어도 게임은 시작되고, 그 이미지만 그려지지 않는다 */
export function loadSprites(): Promise<SpriteImages> {
  loading ??= Promise.all(
    (Object.keys(SPRITES) as SpriteKey[]).map(
      (key) =>
        new Promise<[SpriteKey, HTMLImageElement]>((resolve) => {
          const image = new Image();
          image.onload = () => resolve([key, image]);
          image.onerror = () => resolve([key, image]);
          image.src = SPRITES[key];
        }),
    ),
  ).then((entries) => Object.fromEntries(entries) as SpriteImages);
  return loading;
}

export function isSpriteReady(image: HTMLImageElement) {
  return image.complete && image.naturalWidth > 0;
}
