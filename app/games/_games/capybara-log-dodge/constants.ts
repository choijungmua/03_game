import type { SoundLayer } from "@/lib/lobby/settings";

import type { LogKind } from "./logic";

/** 발소리는 좌우로 움직이는 동안 이 간격(ms)마다 한 번만 */
export const STEP_SOUND_MS = 200;

/** 폴짝: 점프 시작 */
export const JUMP_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", from: 320, to: 760, ms: 140, level: 0.14 },
  { kind: "noise", filter: "bandpass", q: 1, from: 800, to: 1800, ms: 90, level: 0.08 },
];

/** 털썩: 점프 뒤 착지 */
export const LAND_SOUND: readonly SoundLayer[] = [
  { kind: "noise", filter: "lowpass", q: 1, from: 800, to: 200, ms: 80, level: 0.22 },
  { kind: "tone", wave: "sine", from: 140, to: 70, ms: 70, level: 0.12 },
];

/** 쑥↓: 몸을 낮춰 숙이기 */
export const DUCK_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "triangle", from: 520, to: 220, ms: 120, level: 0.1 },
  { kind: "noise", filter: "bandpass", q: 1.2, from: 1400, to: 600, ms: 110, level: 0.1 },
];

/** 웨이브가 비탈 위에서 굴러 나올 때 통나무 종류별 소리 */
export const WAVE_SOUNDS: Record<LogKind, readonly SoundLayer[]> = {
  // 우르르: 통나무가 굴러 내려오는 낮은 소리
  roll: [
    { kind: "noise", filter: "lowpass", q: 0.8, from: 380, to: 160, ms: 260, level: 0.16, attack: 40 },
    { kind: "tone", wave: "sine", from: 80, to: 55, ms: 240, level: 0.1 },
  ],
  // 쿵: 바닥에 깔리는 무거운 허들
  hurdle: [
    { kind: "noise", filter: "lowpass", q: 1, from: 600, to: 120, ms: 180, level: 0.24 },
    { kind: "tone", wave: "sine", from: 110, to: 45, ms: 200, level: 0.15 },
  ],
  // 우르르 쿵쿵: 통나무 벽 두 줄
  wall: [
    { kind: "noise", filter: "lowpass", q: 0.8, from: 450, to: 150, ms: 200, level: 0.18 },
    { at: 120, kind: "noise", filter: "lowpass", q: 0.8, from: 450, to: 150, ms: 200, level: 0.18 },
    { kind: "tone", wave: "sine", from: 90, to: 50, ms: 320, level: 0.1 },
  ],
  // 부웅: 머리 높이로 날아오는 가로대
  beam: [
    { kind: "noise", filter: "bandpass", q: 1.5, from: 300, to: 900, ms: 300, level: 0.16, attack: 120 },
    { kind: "tone", wave: "triangle", from: 180, to: 240, ms: 280, level: 0.07, attack: 100 },
  ],
  // 통통: 튕기는 통나무
  bounce: [
    { kind: "tone", wave: "sine", from: 420, to: 260, ms: 70, level: 0.12 },
    { at: 110, kind: "tone", wave: "sine", from: 380, to: 240, ms: 70, level: 0.1 },
  ],
  // 위잉위잉: 카피바라를 노리고 휘어 오는 통나무
  chase: [
    { kind: "tone", wave: "triangle", from: 300, to: 520, ms: 160, level: 0.08 },
    { at: 160, kind: "tone", wave: "triangle", from: 520, to: 300, ms: 160, level: 0.08 },
    { kind: "noise", filter: "bandpass", q: 2, from: 600, to: 1400, ms: 320, level: 0.08, attack: 60 },
  ],
  // 끼이익: 쪼개질 듯 삐걱거리는 큰 통나무
  split: [
    { kind: "noise", filter: "lowpass", q: 0.8, from: 420, to: 160, ms: 240, level: 0.16 },
    { kind: "tone", wave: "sawtooth", from: 160, to: 120, ms: 260, level: 0.05, attack: 60 },
  ],
};

/** 통: 통나무가 화면 벽에 부딪혀 튕김 */
export const BOUNCE_SOUND: readonly SoundLayer[] = [
  { kind: "noise", filter: "bandpass", q: 3, from: 1200, to: 800, ms: 50, level: 0.22 },
  { kind: "tone", wave: "sine", from: 300, to: 180, ms: 70, level: 0.1 },
];

/** 쩌억: 큰 통나무가 반으로 쪼개짐 */
export const SPLIT_SOUND: readonly SoundLayer[] = [
  { kind: "noise", filter: "highpass", q: 0.7, from: 3000, to: 1200, ms: 60, level: 0.3 },
  { at: 40, kind: "noise", filter: "bandpass", q: 1.2, from: 1600, to: 500, ms: 160, level: 0.22 },
  { kind: "tone", wave: "sine", from: 200, to: 90, ms: 120, level: 0.1 },
];

/** 따단↑: 새 통나무 종류가 나오기 시작함 (난이도 오름) */
export const LEVEL_UP_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "triangle", from: 587, to: 587, ms: 90, level: 0.1 },
  { at: 90, kind: "tone", wave: "triangle", from: 880, to: 880, ms: 160, level: 0.1 },
];

/** 웨이브 속도가 보통이 아닐 때 겹쳐 내는 소리 */
export const PACE_SOUNDS = {
  // 휘이익!: 빠른 통나무가 바람을 가르며 온다
  fast: [
    { kind: "noise", filter: "highpass", q: 0.8, from: 1200, to: 5000, ms: 220, level: 0.18, attack: 30 },
    { kind: "tone", wave: "sawtooth", from: 400, to: 1100, ms: 180, level: 0.05 },
  ],
  // 우우웅: 느릿느릿 무거운 통나무
  slow: [
    { kind: "tone", wave: "sawtooth", from: 95, to: 70, ms: 420, level: 0.06, attack: 80 },
    { kind: "noise", filter: "lowpass", q: 1, from: 260, to: 120, ms: 420, level: 0.14, attack: 80 },
  ],
} as const satisfies Record<"fast" | "slow", readonly SoundLayer[]>;

/** 삐삐↑: "점프!" 안내 — 음이 올라간다 */
export const JUMP_CUE_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "square", from: 660, to: 660, ms: 70, level: 0.06 },
  { at: 90, kind: "tone", wave: "square", from: 990, to: 990, ms: 90, level: 0.06 },
];

/** 삐삐↓: "숙여!" 안내 — 음이 내려간다 */
export const DUCK_CUE_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "square", from: 660, to: 660, ms: 70, level: 0.06 },
  { at: 90, kind: "tone", wave: "square", from: 440, to: 440, ms: 90, level: 0.06 },
];

/** 반짝: 유자 보호막이 떨어지기 시작 */
export const PICKUP_SPAWN_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", from: 1320, to: 1320, ms: 60, level: 0.06 },
  { at: 70, kind: "tone", wave: "sine", from: 1760, to: 1760, ms: 90, level: 0.06 },
];

/** 뾰로롱: 유자 보호막 획득 */
export const SHIELD_GET_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "triangle", from: 784, to: 784, ms: 70, level: 0.12 },
  { at: 60, kind: "tone", wave: "triangle", from: 988, to: 988, ms: 70, level: 0.12 },
  { at: 120, kind: "tone", wave: "triangle", from: 1319, to: 1319, ms: 70, level: 0.12 },
  { at: 180, kind: "tone", wave: "sine", from: 1568, to: 1760, ms: 200, level: 0.12 },
];

/** 퉁-쨍그랑: 보호막이 통나무를 막고 깨짐 */
export const SHIELD_BREAK_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", from: 260, to: 90, ms: 160, level: 0.2 },
  { kind: "noise", filter: "highpass", q: 0.7, from: 4000, to: 2000, ms: 260, level: 0.2 },
  { at: 60, kind: "tone", wave: "triangle", from: 1800, to: 1200, ms: 200, level: 0.08 },
];

/** 아슬아슬 콤보: 이어질수록 한 음씩 높아진다 (도-미-솔-도-미) */
export const COMBO_SOUNDS: readonly (readonly SoundLayer[])[] = [523, 659, 784, 1047, 1319].map((hz) => [
  { kind: "tone", wave: "triangle", from: hz, to: hz * 1.06, ms: 140, level: 0.11 },
  { at: 50, kind: "tone", wave: "sine", from: hz * 2, to: hz * 2, ms: 120, level: 0.05 },
]);

/** 달리기 비트: 60초까지 min→max로 빨라지고, 러시 구간에선 1초마다 1BPM씩 rush까지 더 빨라진다 */
export const BEAT_BPM = { min: 112, max: 172, rush: 240 } as const;
/** 쿵: 매 박 */
export const BEAT_KICK: SoundLayer = { kind: "tone", wave: "sine", from: 150, to: 45, ms: 130, level: 0.13 };
/** 칙: 박 사이 (at은 박 간격 절반으로 바꿔 쓴다) */
export const BEAT_HAT: SoundLayer = { kind: "noise", filter: "highpass", q: 0.7, from: 7000, to: 6000, ms: 40, level: 0.05 };
/** 짝: 2·4박 */
export const BEAT_SNARE: SoundLayer = { kind: "noise", filter: "bandpass", q: 0.9, from: 1800, to: 1200, ms: 90, level: 0.08 };

/** 빠라밤↑: 플레이 중 다음 등급 시간을 넘김 */
export const TIER_UP_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "triangle", from: 659, to: 659, ms: 90, level: 0.12 },
  { at: 80, kind: "tone", wave: "triangle", from: 880, to: 880, ms: 90, level: 0.12 },
  { at: 160, kind: "tone", wave: "triangle", from: 1175, to: 1175, ms: 240, level: 0.13 },
];
