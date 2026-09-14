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

/** 빠라밤↑: 플레이 중 다음 등급 시간을 넘김 */
export const TIER_UP_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "triangle", from: 659, to: 659, ms: 90, level: 0.12 },
  { at: 80, kind: "tone", wave: "triangle", from: 880, to: 880, ms: 90, level: 0.12 },
  { at: 160, kind: "tone", wave: "triangle", from: 1175, to: 1175, ms: 240, level: 0.13 },
];
