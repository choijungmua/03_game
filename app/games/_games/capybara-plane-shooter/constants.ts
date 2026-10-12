import { GAME_SOUNDS } from "@/lib/games/constants";
import type { SoundLayer } from "@/lib/lobby/settings";

import type { SkillKind, WeaponKind } from "./logic";

/** 스킬 버튼 순서(위→아래)와 키보드 단축키. key는 버튼 이름에 붙여 보여준다 */
export const SKILL_KEYS: Record<SkillKind, { key: string; keys: readonly string[] }> = {
  barrier: { key: "Z", keys: ["z", "Z", "1"] },
  overdrive: { key: "X", keys: ["x", "X", "2"] },
  bomb: { key: "Space", keys: [" ", "c", "C", "3"] },
};

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
  shieldBlock: 90,
  dasherWarn: 250,
  summon: 400,
} as const;

export const PLANE_SHOOTER_SOUNDS = {
  /** 무기별 자동 발사음 (아주 작게) */
  fire: {
    /** 퓻: 풀잎탄 */
    basic: [{ kind: "noise", filter: "bandpass", q: 4, color: "pink", from: 3200, to: 1600, ms: 40, level: 0.05 }],
    /** 퓻퓻: 해바라기씨 쌍발 (좌우로 살짝 벌어진다) */
    double: [
      { kind: "noise", filter: "bandpass", q: 4, color: "pink", from: 3200, to: 1600, ms: 35, level: 0.045, pan: -0.25 },
      { at: 25, kind: "noise", filter: "bandpass", q: 4, color: "pink", from: 3600, to: 1800, ms: 35, level: 0.045, pan: 0.25 },
    ],
    /** 파샥: 귤 산탄 — 바람 한 줌 + 귤껍질 톡 */
    spread: [
      { kind: "noise", filter: "bandpass", q: 2, color: "pink", from: 2600, to: 1200, ms: 60, level: 0.08 },
      { kind: "tone", wave: "sine", from: 900, to: 880, ms: 50, level: 0.03, fm: { ratio: 2.76, index: 0.4 } },
    ],
    /** 틱: 옥수수 연사 (가장 짧게) — 나무 알갱이 톡 */
    rapid: [{ kind: "tone", wave: "sine", from: 1900, to: 1850, ms: 25, level: 0.03, fm: { ratio: 2.76, index: 0.4 }, wet: 0 }],
    /** 슈웅: 사탕수수 관통 — 길게 가르는 바람 */
    pierce: [{ kind: "noise", filter: "bandpass", q: 3, color: "pink", from: 2400, to: 500, ms: 120, level: 0.06 }],
  } satisfies Record<WeaponKind, readonly SoundLayer[]>,
  /** 스윽: 비행기가 좌우로 기울며 움직이기 시작 */
  move: [{ kind: "noise", filter: "bandpass", q: 1.5, color: "pink", from: 300, to: 900, ms: 140, level: 0.05, attack: 40 }],
  /** 탁: 적이 총알에 맞음 (아직 안 죽음) — 가죽 북 */
  enemyHit: [
    { kind: "noise", filter: "bandpass", q: 2, color: "pink", from: 2000, to: 1400, ms: 30, level: 0.09, wet: 0 },
    { kind: "tone", wave: "sine", from: 420, to: 260, ms: 40, level: 0.05 },
  ],
  /** 퍼벙: 적 격추 — 갈색 소음 퍽 + 둔한 저음 */
  enemyDown: [
    { kind: "noise", filter: "lowpass", q: 0.8, color: "brown", from: 1600, to: 120, ms: 260, level: 0.3, wet: 0.2 },
    { kind: "tone", wave: "sine", from: 180, to: 55, ms: 200, level: 0.12 },
  ],
  /** 팅: 보스 가죽에 튕김 (보스는 안 죽는다) — 돌 튕기는 소리 */
  bossHit: [{ kind: "tone", wave: "sine", from: 2300, to: 2280, ms: 40, level: 0.03, fm: { ratio: 1.4, index: 0.8 }, wet: 0 }],
  /** 팅: 아르마딜로 방패에 총알이 막힘 — 돌 껍데기 */
  shieldBlock: [
    { kind: "tone", wave: "sine", from: 1600, to: 1580, ms: 60, level: 0.04, fm: { ratio: 1.4, index: 1 } },
    { kind: "noise", filter: "highpass", q: 2, from: 4000, to: 3000, ms: 20, level: 0.05, wet: 0 },
  ],
  /** 뾰로롱: 독화살개구리가 둘로 갈라짐 — 물방울 두 개가 양쪽으로 */
  split: [
    { kind: "tone", wave: "sine", from: 400, to: 900, ms: 90, level: 0.08, pan: -0.4, lowpass: 4000 },
    { at: 70, kind: "tone", wave: "sine", from: 500, to: 1100, ms: 90, level: 0.07, pan: 0.4, lowpass: 4000 },
  ],
  /** 똑똑: 칼새가 멈춰 돌진을 예고 — 우드블록 두 번 */
  dasherWarn: [
    { kind: "tone", wave: "sine", from: 1200, to: 1190, ms: 80, level: 0.06, fm: { ratio: 2.76, index: 0.8 } },
    { at: 90, kind: "tone", wave: "sine", from: 1500, to: 1490, ms: 80, level: 0.06, fm: { ratio: 2.76, index: 0.8 } },
  ],
  /** 뿅: 조준 사격 적이 쏨 — 씨앗 퐁 */
  enemyShot: [{ kind: "tone", wave: "sine", from: 560, to: 360, ms: 80, level: 0.06, lowpass: 2500 }],
  /** 부웅: 보스 탄막 발사 — 따뜻한 저음 + 갈색 바람 */
  bossShot: [
    { kind: "tone", wave: "sawtooth", from: 320, to: 180, ms: 120, level: 0.04, detune: 10, lowpass: 1200 },
    { kind: "noise", filter: "lowpass", q: 1, color: "brown", from: 900, to: 300, ms: 120, level: 0.1 },
  ],
  /** 퍽 + "아야!": 비행기가 맞음 */
  damage: [
    ...GAME_SOUNDS.hit,
    { at: 40, kind: "noise", filter: "lowpass", q: 1, color: "brown", from: 900, to: 150, ms: 220, level: 0.15 },
    ...delay(GAME_SOUNDS.ouch, 60),
  ],
  /** 퍽 뒤 "조심해!": 체력이 한 칸 남음 */
  lowHp: [...GAME_SOUNDS.hit, ...delay(GAME_SOUNDS.warning, 260)],
  /** 띠링↑: 무기 간식 먹음 */
  weaponPickup: [
    ...GAME_SOUNDS.pickup,
    { at: 160, kind: "tone", wave: "sine", from: 1760, to: 1756, ms: 220, level: 0.07, fm: { ratio: 3.5, index: 0.6 }, wet: 0.3 },
  ],
  /** 포로롱 + "아 시원해": 유자 온천 회복 — 칼림바 셋 */
  heal: [
    { kind: "tone", wave: "sine", from: 659, to: 659, ms: 200, level: 0.1, fm: { ratio: 3.5, index: 0.6 }, pan: -0.2, wet: 0.35 },
    { at: 80, kind: "tone", wave: "sine", from: 784, to: 784, ms: 200, level: 0.1, fm: { ratio: 3.5, index: 0.6 }, wet: 0.35 },
    { at: 160, kind: "tone", wave: "sine", from: 988, to: 988, ms: 320, level: 0.1, fm: { ratio: 3.5, index: 0.6 }, pan: 0.2, wet: 0.4 },
    { at: 200, kind: "voice", line: "ahh", from: 8000, to: 6000, ms: 700, level: 0.65 },
  ],
  /** 따단 + "나이스!": 일반 스테이지 클리어 — 마림바 */
  stageClear: [
    { kind: "tone", wave: "sine", from: 784, to: 784, ms: 180, level: 0.12, fm: { ratio: 4, index: 0.8 }, wet: 0.3 },
    { at: 110, kind: "tone", wave: "sine", from: 1175, to: 1175, ms: 360, level: 0.13, fm: { ratio: 4, index: 0.8 }, wet: 0.4 },
    { at: 300, kind: "voice", line: "great", from: 9000, to: 7000, ms: 600, level: 0.75 },
  ],
  /** 콰광 뒤 빠밤빠밤!: 카이만 보스 격파 */
  bossDefeat: [...GAME_SOUNDS.explosion, ...delay(GAME_SOUNDS.success, 300)],
  /** 그르렁↑ 뒤 "조심해!": 보스가 다음 페이즈로 (체력 2/3·1/3) */
  bossPhase: [
    { kind: "tone", wave: "sawtooth", from: 90, to: 180, ms: 380, level: 0.08, attack: 40, detune: 15, lowpass: 900 },
    { kind: "noise", filter: "lowpass", q: 1, color: "brown", from: 300, to: 900, ms: 380, level: 0.22, attack: 40 },
    ...delay(GAME_SOUNDS.warning, 380),
  ],
  /** 둥둥 + "우와!": 보스 스테이지 진입 — 징 두 번이 깊게 울린다 */
  bossStage: [
    { kind: "tone", wave: "sine", from: 220, to: 218, ms: 700, level: 0.14, fm: { ratio: 1.4, index: 1.4 }, wet: 0.5 },
    { at: 450, kind: "tone", wave: "sine", from: 165, to: 163, ms: 900, level: 0.14, fm: { ratio: 1.4, index: 1.4 }, wet: 0.5 },
    // 스테이지 클리어 "나이스!" 바로 뒤에 이어지므로 한 박 늦춘다
    { at: 1000, kind: "voice", line: "woah", from: 9000, to: 7000, ms: 500, level: 0.75 },
  ],
  /** 그르르: 카이만 보스 등장 — 땅울림 */
  bossAppear: [
    { kind: "tone", wave: "sawtooth", from: 110, to: 60, ms: 700, level: 0.08, attack: 80, detune: 18, lowpass: 600 },
    { kind: "noise", filter: "lowpass", q: 1, color: "brown", from: 500, to: 120, ms: 700, level: 0.26, attack: 80, wet: 0.3 },
  ],
  /** 똑-딱: 보스 패턴 바뀜 — 우드블록 */
  bossPattern: [
    { kind: "tone", wave: "sine", from: 520, to: 515, ms: 90, level: 0.07, fm: { ratio: 2.76, index: 0.8 } },
    { at: 70, kind: "tone", wave: "sine", from: 780, to: 775, ms: 90, level: 0.07, fm: { ratio: 2.76, index: 0.8 } },
  ],
  /** 띠용띠용: 보스가 돌격을 마치고 어지러워 기절 — 칼림바가 양쪽으로 빙글 */
  bossStun: [
    { kind: "tone", wave: "sine", from: 900, to: 600, ms: 110, level: 0.07, fm: { ratio: 3.5, index: 0.5 }, pan: -0.4 },
    { at: 110, kind: "tone", wave: "sine", from: 1000, to: 700, ms: 110, level: 0.07, fm: { ratio: 3.5, index: 0.5 }, pan: 0.4 },
    { at: 220, kind: "tone", wave: "sine", from: 1100, to: 800, ms: 140, level: 0.07, fm: { ratio: 3.5, index: 0.5 }, pan: -0.4 },
  ],
  /** 위이잉: 레이저 충전 예고 — 바람이 모여든다 */
  laserWarn: [
    { kind: "tone", wave: "sawtooth", from: 200, to: 900, ms: 850, level: 0.04, attack: 200, detune: 12, lowpass: 2000 },
    { kind: "noise", filter: "bandpass", q: 3, color: "pink", from: 400, to: 3000, ms: 850, level: 0.06, attack: 300 },
  ],
  /** 지이이잉: 레이저 발사 */
  laserBeam: [
    { kind: "tone", wave: "sawtooth", from: 140, to: 130, ms: 1500, level: 0.05, attack: 20, detune: 20, lowpass: 1500 },
    { kind: "noise", filter: "bandpass", q: 2, color: "pink", from: 1800, to: 1400, ms: 1500, level: 0.12, attack: 20, wet: 0.2 },
  ],
  /** 붕붕: 보스가 말벌 부하를 부름 — 날갯짓이 좌우로 */
  summon: [
    { kind: "tone", wave: "sawtooth", from: 180, to: 220, ms: 160, level: 0.04, detune: 25, lowpass: 1500, pan: -0.3 },
    { at: 140, kind: "tone", wave: "sawtooth", from: 200, to: 250, ms: 160, level: 0.04, detune: 25, lowpass: 1500, pan: 0.3 },
  ],
  /** 삐삐 + "조심해!": 돌격 예고 */
  chargeWindup: GAME_SOUNDS.warning,
  /** 휘익: 보스가 내리꽂음 */
  chargeDash: [{ kind: "noise", filter: "bandpass", q: 1, color: "pink", from: 2200, to: 300, ms: 450, level: 0.3, attack: 30 }],
  /** 콰광 뒤 뿌우우: 격추당해 게임 오버 */
  gameOver: [...GAME_SOUNDS.explosion, ...delay(GAME_SOUNDS.fail, 350)],
  /** 우웅↑ 반짝 + "얍!": 방어막 — 물방울 막이 부풀어 오른다 */
  barrier: [
    { kind: "voice", line: "hup", from: 8000, to: 6000, ms: 300, level: 0.55 },
    { kind: "tone", wave: "sine", from: 300, to: 900, ms: 300, level: 0.1, attack: 40, lowpass: 3000, wet: 0.3 },
    { at: 120, kind: "tone", wave: "sine", from: 1400, to: 1400, ms: 300, level: 0.05, fm: { ratio: 3.5, index: 0.6 }, wet: 0.4 },
  ],
  /** 지지징↑ + "얍!": 폭주 */
  overdrive: [
    { kind: "voice", line: "hup", from: 8000, to: 6000, ms: 300, level: 0.55 },
    { kind: "tone", wave: "sawtooth", from: 200, to: 1200, ms: 380, level: 0.06, attack: 30, detune: 15, lowpass: 3500 },
    { kind: "noise", filter: "bandpass", q: 1.5, color: "pink", from: 800, to: 4000, ms: 380, level: 0.1, attack: 30 },
  ],
  /** 콰-아앙 + "대박!": 폭탄 — 갈색 소음 울림 */
  bomb: [
    ...GAME_SOUNDS.explosion,
    { kind: "noise", filter: "lowpass", q: 0.7, color: "brown", from: 3000, to: 150, ms: 900, level: 0.4, attack: 20, wet: 0.4 },
    { kind: "tone", wave: "sine", from: 90, to: 30, ms: 700, level: 0.2 },
    { at: 250, kind: "voice", line: "wow", from: 10000, to: 8000, ms: 600, level: 0.8 },
  ],
  /** 띠링띠링: 스킬 게이지가 가득 참 — 칼림바 */
  skillReady: [
    { kind: "tone", wave: "sine", from: 1319, to: 1319, ms: 160, level: 0.08, fm: { ratio: 3.5, index: 0.6 }, wet: 0.3 },
    { at: 90, kind: "tone", wave: "sine", from: 1760, to: 1760, ms: 260, level: 0.08, fm: { ratio: 3.5, index: 0.6 }, wet: 0.35 },
  ],
  /** 반짝 + "레벨업!": 무기 레벨 최대 도달 */
  weaponMax: delay(GAME_SOUNDS.levelUp, 200),
  /** 뚜루↓: 맞아서 무기 레벨이 내려감 (피격음 뒤) — 마림바가 내려간다 */
  levelDown: [
    { at: 120, kind: "tone", wave: "sine", from: 700, to: 695, ms: 140, level: 0.07, fm: { ratio: 4, index: 0.6 } },
    { at: 210, kind: "tone", wave: "sine", from: 466, to: 462, ms: 240, level: 0.07, fm: { ratio: 4, index: 0.6 }, wet: 0.25 },
  ],
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
  /** 폭탄 고리가 퍼지는 시간과 최대 반경 */
  ringMs: 520,
  ringRadius: 520,
  /** 맞은 순간 게임을 잠깐 멈춰 맞았다는 걸 느끼게 한다 */
  hitStopMs: 70,
  shake: {
    enemyDown: { power: 2, ms: 110 },
    damage: { power: 7, ms: 260 },
    chargeDash: { power: 5, ms: 320 },
    bossClear: { power: 9, ms: 450 },
    gameOver: { power: 10, ms: 520 },
  },
  burst: {
    hit: { count: 3, speed: 90 },
    enemyDown: { count: 12, speed: 170 },
    pickup: { count: 10, speed: 120 },
    gameOver: { count: 40, speed: 260 },
  },
} as const;
