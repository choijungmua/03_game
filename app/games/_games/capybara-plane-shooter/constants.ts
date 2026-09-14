import { GAME_SOUNDS } from "@/lib/games/constants";
import type { SoundLayer } from "@/lib/lobby/settings";

import type { WeaponKind } from "./logic";

/** 소리 묶음을 ms만큼 늦게 시작시킨다 (다른 소리 뒤에 이어 붙일 때) */
function delay(layers: readonly SoundLayer[], ms: number): SoundLayer[] {
  return layers.map((layer) => ({ ...layer, at: (layer.at ?? 0) + ms }));
}

/** 같은 소리를 이 간격(ms) 안에는 다시 내지 않는다 — 자동 연사·다발 격추가 귀를 때리지 않게 */
export const SOUND_GAP_MS = {
  fire: 150,
  move: 350,
  enemyHit: 70,
  enemyDown: 60,
  bossHit: 110,
  enemyShot: 180,
  bossShot: 220,
} as const;

export const PLANE_SHOOTER_SOUNDS = {
  /** 무기별 자동 발사음 (아주 작게) */
  fire: {
    /** 퓻: 풀잎탄 */
    basic: [{ kind: "tone", wave: "triangle", from: 1500, to: 700, ms: 45, level: 0.04 }],
    /** 퓻퓻: 해바라기씨 쌍발 */
    double: [
      { kind: "tone", wave: "triangle", from: 1500, to: 700, ms: 40, level: 0.035 },
      { at: 25, kind: "tone", wave: "triangle", from: 1700, to: 800, ms: 40, level: 0.035 },
    ],
    /** 파샥: 귤 산탄 */
    spread: [
      { kind: "noise", filter: "bandpass", q: 2, from: 2600, to: 1200, ms: 60, level: 0.08 },
      { kind: "tone", wave: "triangle", from: 1100, to: 500, ms: 55, level: 0.035 },
    ],
    /** 틱: 옥수수 연사 (가장 짧게) */
    rapid: [{ kind: "tone", wave: "square", from: 1900, to: 1200, ms: 25, level: 0.025 }],
    /** 슈웅: 사탕수수 관통 */
    pierce: [{ kind: "tone", wave: "sawtooth", from: 900, to: 250, ms: 110, level: 0.04 }],
  } satisfies Record<WeaponKind, readonly SoundLayer[]>,
  /** 스윽: 비행기가 좌우로 기울며 움직이기 시작 */
  move: [{ kind: "noise", filter: "bandpass", q: 1.5, from: 300, to: 900, ms: 140, level: 0.05, attack: 40 }],
  /** 탁: 적이 총알에 맞음 (아직 안 죽음) */
  enemyHit: [
    { kind: "noise", filter: "highpass", q: 1, from: 2400, to: 1800, ms: 30, level: 0.1 },
    { kind: "tone", wave: "sine", from: 500, to: 300, ms: 35, level: 0.05 },
  ],
  /** 퍼벙: 적 격추 */
  enemyDown: [
    { kind: "noise", filter: "lowpass", q: 0.8, from: 1800, to: 150, ms: 240, level: 0.26 },
    { kind: "tone", wave: "sine", from: 200, to: 60, ms: 200, level: 0.12 },
  ],
  /** 팅: 보스 가죽에 튕김 (보스는 안 죽는다) */
  bossHit: [{ kind: "tone", wave: "square", from: 2300, to: 2100, ms: 25, level: 0.03 }],
  /** 뿅: 조준 사격 적이 쏨 */
  enemyShot: [{ kind: "tone", wave: "sine", from: 560, to: 360, ms: 80, level: 0.06 }],
  /** 부웅: 보스 탄막 발사 */
  bossShot: [
    { kind: "tone", wave: "sawtooth", from: 320, to: 180, ms: 120, level: 0.045 },
    { kind: "noise", filter: "lowpass", q: 1, from: 900, to: 300, ms: 120, level: 0.08 },
  ],
  /** 퍽+지직: 비행기가 맞음 */
  damage: [
    ...GAME_SOUNDS.hit,
    { at: 40, kind: "tone", wave: "square", from: 220, to: 120, ms: 220, level: 0.07 },
  ],
  /** 퍽 뒤 삐삐: 체력이 한 칸 남음 */
  lowHp: [...GAME_SOUNDS.hit, ...delay(GAME_SOUNDS.warning, 260)],
  /** 띠링↑: 무기 간식 먹음 */
  weaponPickup: [
    ...GAME_SOUNDS.pickup,
    { at: 160, kind: "tone", wave: "triangle", from: 880, to: 1760, ms: 160, level: 0.08 },
  ],
  /** 포로롱: 유자 온천 회복 */
  heal: [
    { kind: "tone", wave: "sine", from: 659, to: 659, ms: 90, level: 0.11 },
    { at: 80, kind: "tone", wave: "sine", from: 784, to: 784, ms: 90, level: 0.11 },
    { at: 160, kind: "tone", wave: "sine", from: 988, to: 988, ms: 220, level: 0.11 },
  ],
  /** 따단: 일반 스테이지 클리어 */
  stageClear: [
    { kind: "tone", wave: "triangle", from: 784, to: 784, ms: 110, level: 0.13 },
    { at: 110, kind: "tone", wave: "triangle", from: 1175, to: 1175, ms: 260, level: 0.14 },
  ],
  /** 빠밤빠밤!: 보스 버티기 성공 */
  bossClear: GAME_SOUNDS.success,
  /** 웨엥웨엥: 보스 스테이지 진입 경보 */
  bossStage: [
    { kind: "tone", wave: "sawtooth", from: 440, to: 660, ms: 300, level: 0.06 },
    { at: 300, kind: "tone", wave: "sawtooth", from: 660, to: 440, ms: 300, level: 0.06 },
    { at: 600, kind: "tone", wave: "sawtooth", from: 440, to: 660, ms: 300, level: 0.06 },
    { at: 900, kind: "tone", wave: "sawtooth", from: 660, to: 440, ms: 300, level: 0.06 },
  ],
  /** 그르르: 카이만 보스 등장 */
  bossAppear: [
    { kind: "tone", wave: "sawtooth", from: 110, to: 60, ms: 700, level: 0.09, attack: 80 },
    { kind: "noise", filter: "lowpass", q: 1, from: 500, to: 120, ms: 700, level: 0.2, attack: 80 },
  ],
  /** 뚜-딧: 보스 패턴 바뀜 */
  bossPattern: [
    { kind: "tone", wave: "square", from: 520, to: 520, ms: 60, level: 0.05 },
    { at: 70, kind: "tone", wave: "square", from: 780, to: 780, ms: 60, level: 0.05 },
  ],
  /** 삐삐: 돌격 예고 */
  chargeWindup: GAME_SOUNDS.warning,
  /** 휘익: 보스가 내리꽂음 */
  chargeDash: [{ kind: "noise", filter: "bandpass", q: 1, from: 2200, to: 300, ms: 450, level: 0.3, attack: 30 }],
  /** 콰광 뒤 뿌우우: 격추당해 게임 오버 */
  gameOver: [...GAME_SOUNDS.explosion, ...delay(GAME_SOUNDS.fail, 350)],
  /** 반짝반짝: 1위 기록 (격추 뒤 결과 화면이 뜨고 조금 있다가) */
  newRecord: delay(GAME_SOUNDS.record, 400),
} as const satisfies Record<string, readonly SoundLayer[] | Record<WeaponKind, readonly SoundLayer[]>>;

/** 결과 화면이 뜬 뒤 이 시간 동안은 탭·Space·Enter로 다시 시작하지 않는다 — 드래그하던 손을 떼는 click이 결과를 보기도 전에 새 판을 열지 않게 */
export const RESULT_TAP_GUARD_MS = 800;
/** 격추당한 뒤 세상을 멈추고 비행기가 터지는 모습을 보여준 다음 결과 화면으로 넘어가기까지 */
export const GAME_OVER_MS = 1100;
/** 격추당한 비행기 폭발 그림을 재생하는 시간과 크기(게임 좌표 px) */
export const PLANE_EXPLOSION_MS = 600;
export const PLANE_EXPLOSION_SIZE = 120;

/** 손맛 연출 값 (거리는 게임 좌표 px, 시간은 ms). 움직임 줄이기 설정이면 흔들림·파편은 끈다 */
export const EFFECTS = {
  maxParticles: 160,
  particleLifeMs: 520,
  /** 파편이 떨어지는 가속도 (px/초²) */
  particleGravity: 420,
  popupMs: 800,
  /** 떠오르는 글자가 사라질 때까지 올라가는 거리 */
  popupRise: 34,
  muzzleMs: 50,
  damageFlashMs: 320,
  /** 맞은 순간 게임을 잠깐 멈춰 맞았다는 걸 느끼게 한다 */
  hitStopMs: 70,
  shake: {
    enemyDown: { power: 2, ms: 110 },
    damage: { power: 7, ms: 260 },
    chargeDash: { power: 5, ms: 320 },
    bossClear: { power: 4, ms: 280 },
    gameOver: { power: 10, ms: 520 },
  },
  burst: {
    hit: { count: 3, speed: 90 },
    enemyDown: { count: 12, speed: 170 },
    pickup: { count: 10, speed: 120 },
    gameOver: { count: 40, speed: 260 },
  },
} as const;
