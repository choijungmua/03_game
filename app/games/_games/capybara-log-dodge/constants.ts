import type { SoundLayer } from "@/lib/lobby/settings";

import type { LogKind } from "./logic";

/** 발소리는 좌우로 움직이는 동안 이 간격(ms)마다 한 번만 */
export const STEP_SOUND_MS = 200;

/** 폴짝: 점프 시작 — 칼림바 톡 + 털 스치는 바람 */
export const JUMP_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", fm: { ratio: 3.5, index: 1.2 }, from: 520, to: 780, ms: 150, level: 0.12, wet: 0.15 },
  { kind: "noise", color: "pink", filter: "bandpass", q: 1, from: 700, to: 2000, ms: 110, level: 0.08 },
];

/** 폭: 흙바닥에 착지 */
export const LAND_SOUND: readonly SoundLayer[] = [
  { kind: "noise", color: "brown", filter: "lowpass", q: 0.9, from: 900, to: 180, ms: 90, level: 0.24 },
  { kind: "tone", wave: "sine", from: 130, to: 65, ms: 80, level: 0.1 },
];

/** 쓱: 풀숲에 엎드려 미끄러짐 */
export const DUCK_SOUND: readonly SoundLayer[] = [
  { kind: "noise", color: "pink", filter: "bandpass", q: 1.2, from: 1800, to: 500, ms: 140, level: 0.13 },
  { kind: "tone", wave: "sine", fm: { ratio: 2.76, index: 0.6 }, from: 440, to: 260, ms: 110, level: 0.06 },
];

/** 웨이브가 비탈 위에서 굴러 나올 때 통나무 종류별 소리 */
export const WAVE_SOUNDS: Record<LogKind, readonly SoundLayer[]> = {
  // 우르르: 통나무가 흙길을 굴러 내려오는 낮은 소리
  roll: [
    { kind: "noise", color: "brown", filter: "lowpass", q: 0.8, from: 420, to: 160, ms: 300, level: 0.2, attack: 40, wet: 0.2 },
    { kind: "tone", wave: "sine", from: 80, to: 55, ms: 260, level: 0.1 },
  ],
  // 쿵: 바닥에 깔리는 무거운 허들
  hurdle: [
    { kind: "noise", color: "brown", filter: "lowpass", q: 1, from: 700, to: 120, ms: 220, level: 0.28, wet: 0.25 },
    { kind: "tone", wave: "sine", fm: { ratio: 1.4, index: 0.8 }, from: 110, to: 45, ms: 240, level: 0.14 },
  ],
  // 우르르 쿵쿵: 통나무 벽 두 줄 (왼쪽·오른쪽)
  wall: [
    { kind: "noise", color: "brown", filter: "lowpass", q: 0.8, from: 450, to: 150, ms: 220, level: 0.18, pan: -0.35 },
    { at: 120, kind: "noise", color: "brown", filter: "lowpass", q: 0.8, from: 450, to: 150, ms: 220, level: 0.18, pan: 0.35 },
    { kind: "tone", wave: "sine", from: 90, to: 50, ms: 320, level: 0.1, wet: 0.2 },
  ],
  // 부웅: 머리 높이로 날아오는 가로대가 바람을 밀어냄
  beam: [
    { kind: "noise", color: "pink", filter: "bandpass", q: 1.5, from: 300, to: 1000, ms: 340, level: 0.16, attack: 120, wet: 0.3 },
    { kind: "tone", wave: "sine", from: 180, to: 240, ms: 280, level: 0.06, attack: 100 },
  ],
  // 똑똑: 튕기는 통나무 (나무 마림바)
  bounce: [
    { kind: "tone", wave: "sine", fm: { ratio: 2.76, index: 1.4 }, from: 420, to: 400, ms: 90, level: 0.12, pan: -0.3 },
    { at: 110, kind: "tone", wave: "sine", fm: { ratio: 2.76, index: 1.4 }, from: 380, to: 360, ms: 90, level: 0.1, pan: 0.3 },
  ],
  // 위잉위잉: 카피바라를 노리고 휘어 오는 통나무
  chase: [
    { kind: "tone", wave: "sine", fm: { ratio: 3.5, index: 0.8 }, from: 300, to: 520, ms: 160, level: 0.08, pan: -0.3 },
    { at: 160, kind: "tone", wave: "sine", fm: { ratio: 3.5, index: 0.8 }, from: 520, to: 300, ms: 160, level: 0.08, pan: 0.3 },
    { kind: "noise", color: "pink", filter: "bandpass", q: 2, from: 600, to: 1400, ms: 320, level: 0.08, attack: 60, wet: 0.2 },
  ],
  // 끼이익: 쪼개질 듯 삐걱거리는 큰 통나무
  split: [
    { kind: "noise", color: "brown", filter: "lowpass", q: 0.8, from: 420, to: 160, ms: 260, level: 0.18 },
    { kind: "tone", wave: "sawtooth", detune: 14, lowpass: 700, from: 160, to: 120, ms: 280, level: 0.05, attack: 60 },
  ],
};

/** 통: 통나무가 화면 벽에 부딪혀 튕김 */
export const BOUNCE_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", fm: { ratio: 2.76, index: 2 }, from: 260, to: 230, ms: 110, level: 0.16, wet: 0.15 },
  { kind: "noise", color: "pink", filter: "bandpass", q: 3, from: 1200, to: 800, ms: 50, level: 0.16 },
];

/** 쩌억: 큰 통나무가 반으로 쪼개짐 */
export const SPLIT_SOUND: readonly SoundLayer[] = [
  { kind: "noise", filter: "highpass", q: 0.7, from: 3000, to: 1200, ms: 60, level: 0.26 },
  { at: 40, kind: "noise", color: "pink", filter: "bandpass", q: 1.2, from: 1600, to: 500, ms: 180, level: 0.2, pan: -0.3, wet: 0.2 },
  { at: 40, kind: "noise", color: "pink", filter: "bandpass", q: 1.2, from: 1400, to: 400, ms: 180, level: 0.2, pan: 0.3, wet: 0.2 },
  { kind: "tone", wave: "sine", fm: { ratio: 1.4, index: 0.6 }, from: 200, to: 90, ms: 140, level: 0.1 },
];

/** 또로링↑: 새 통나무 종류가 나오기 시작함 (마림바 두 음) */
export const LEVEL_UP_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", fm: { ratio: 4, index: 1.2 }, from: 587, to: 587, ms: 160, level: 0.11, wet: 0.25 },
  { at: 90, kind: "tone", wave: "sine", fm: { ratio: 4, index: 1.2 }, from: 880, to: 880, ms: 260, level: 0.11, wet: 0.3 },
];

/** 웨이브 속도가 보통이 아닐 때 겹쳐 내는 소리 */
export const PACE_SOUNDS = {
  // 휘이익!: 빠른 통나무가 바람을 가르며 온다
  fast: [
    { kind: "noise", color: "pink", filter: "highpass", q: 0.8, from: 1200, to: 5000, ms: 240, level: 0.18, attack: 30, pan: -0.2 },
    { kind: "noise", color: "pink", filter: "bandpass", q: 2, from: 900, to: 2600, ms: 200, level: 0.08, pan: 0.2 },
  ],
  // 우우웅: 느릿느릿 무거운 통나무
  slow: [
    { kind: "tone", wave: "sawtooth", detune: 10, lowpass: 400, from: 95, to: 70, ms: 440, level: 0.06, attack: 80, wet: 0.2 },
    { kind: "noise", color: "brown", filter: "lowpass", q: 1, from: 260, to: 120, ms: 420, level: 0.16, attack: 80 },
  ],
} as const satisfies Record<"fast" | "slow", readonly SoundLayer[]>;

/** 똑똑↑: 점프하라는 신호 (나무 블록 두 번, 올라감) */
export const JUMP_CUE_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", fm: { ratio: 2.76, index: 1.6 }, from: 660, to: 660, ms: 80, level: 0.1 },
  { at: 90, kind: "tone", wave: "sine", fm: { ratio: 2.76, index: 1.6 }, from: 990, to: 990, ms: 100, level: 0.1 },
];

/** 똑똑↓: 엎드리라는 신호 (나무 블록 두 번, 내려감) */
export const DUCK_CUE_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", fm: { ratio: 2.76, index: 1.6 }, from: 660, to: 660, ms: 80, level: 0.1 },
  { at: 90, kind: "tone", wave: "sine", fm: { ratio: 2.76, index: 1.6 }, from: 440, to: 440, ms: 100, level: 0.1 },
];

/** 띠링: 아이템이 나타남 (작은 칼림바) */
export const PICKUP_SPAWN_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", fm: { ratio: 3.5, index: 0.8 }, from: 1320, to: 1320, ms: 90, level: 0.06, wet: 0.3 },
  { at: 70, kind: "tone", wave: "sine", fm: { ratio: 3.5, index: 0.8 }, from: 1760, to: 1760, ms: 140, level: 0.06, wet: 0.35 },
];

/** 또로로링: 방패 얻음 (마림바 아르페지오) */
export const SHIELD_GET_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", fm: { ratio: 4, index: 1 }, from: 784, to: 784, ms: 110, level: 0.11, pan: -0.2 },
  { at: 60, kind: "tone", wave: "sine", fm: { ratio: 4, index: 1 }, from: 988, to: 988, ms: 110, level: 0.11 },
  { at: 120, kind: "tone", wave: "sine", fm: { ratio: 4, index: 1 }, from: 1319, to: 1319, ms: 110, level: 0.11, pan: 0.2 },
  { at: 180, kind: "tone", wave: "sine", detune: 8, from: 1568, to: 1760, ms: 260, level: 0.08, wet: 0.4 },
];

/** 쨍그랑: 방패가 깨짐 (돌에 부딪힌 유리 방울) */
export const SHIELD_BREAK_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", fm: { ratio: 1.4, index: 1.5 }, from: 260, to: 90, ms: 180, level: 0.18 },
  { kind: "noise", filter: "highpass", q: 0.7, from: 4000, to: 2000, ms: 260, level: 0.16, wet: 0.3 },
  { at: 60, kind: "tone", wave: "sine", fm: { ratio: 3.5, index: 1 }, from: 1800, to: 1200, ms: 220, level: 0.07, pan: 0.3, wet: 0.3 },
];

/** 아슬아슬 콤보: 이어질수록 한 음씩 높아지는 칼림바 (도-미-솔-도-미) */
export const COMBO_SOUNDS: readonly (readonly SoundLayer[])[] = [523, 659, 784, 1047, 1319].map((hz) => [
  { kind: "tone", wave: "sine", fm: { ratio: 3.5, index: 1 }, from: hz, to: hz, ms: 180, level: 0.11, wet: 0.2 },
  { at: 50, kind: "tone", wave: "sine", from: hz * 2, to: hz * 2, ms: 140, level: 0.04, wet: 0.3 },
]);

/** 달리기 비트: 60초까지 min→max로 빨라지고, 러시 구간에선 1초마다 1BPM씩 rush까지 더 빨라진다 */
export const BEAT_BPM = { min: 112, max: 172, rush: 240 } as const;
/** 쿵: 매 박 (나무 북) */
export const BEAT_KICK: SoundLayer = { kind: "tone", wave: "sine", fm: { ratio: 1.4, index: 0.4 }, from: 140, to: 50, ms: 130, level: 0.13 };
/** 칙: 박 사이 셰이커 (at은 박 간격 절반으로 바꿔 쓴다) */
export const BEAT_HAT: SoundLayer = { kind: "noise", color: "pink", filter: "highpass", q: 0.7, from: 6000, to: 5000, ms: 45, level: 0.05, pan: 0.25 };
/** 탁: 2·4박 나무 블록 */
export const BEAT_SNARE: SoundLayer = { kind: "tone", wave: "sine", fm: { ratio: 2.76, index: 1.8 }, from: 520, to: 500, ms: 70, level: 0.07, pan: -0.15 };

/** 빠라밤↑: 플레이 중 다음 등급 시간을 넘김 (마림바 세 음 + 울림) */
export const TIER_UP_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", fm: { ratio: 4, index: 1.2 }, from: 659, to: 659, ms: 140, level: 0.12, pan: -0.2 },
  { at: 80, kind: "tone", wave: "sine", fm: { ratio: 4, index: 1.2 }, from: 880, to: 880, ms: 140, level: 0.12 },
  { at: 160, kind: "tone", wave: "sine", fm: { ratio: 4, index: 1.2 }, from: 1175, to: 1175, ms: 320, level: 0.13, pan: 0.2, wet: 0.4 },
];
