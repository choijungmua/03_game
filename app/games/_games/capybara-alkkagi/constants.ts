import type { SoundLayer } from "@/lib/lobby/settings";

/** 알까기 전용 합성 효과음. 여러 게임이 같이 쓰는 소리는 GAME_SOUNDS(@/lib/games/constants)에서 꺼내 쓴다 */
export const ALKKAGI_SOUNDS = {
  /** 꾹: 알을 손가락으로 집음 */
  grab: [
    { kind: "noise", filter: "bandpass", q: 2, from: 900, to: 600, ms: 40, level: 0.2 },
    { kind: "tone", wave: "sine", from: 320, to: 260, ms: 60, level: 0.1 },
  ],
  /** 끼릭: 뒤로 당기는 고무줄 (힘에 따라 음을 올려서 재생) */
  stretch: [{ kind: "tone", wave: "triangle", from: 220, to: 240, ms: 45, level: 0.05 }],
  /** 틱: 방향키로 조준·힘 조절 */
  aim: [{ kind: "tone", wave: "sine", from: 1400, to: 1300, ms: 25, level: 0.06 }],
  /** 따악: 손가락으로 알을 튕김 (힘에 따라 크기 조절) */
  flick: [
    { kind: "noise", filter: "bandpass", q: 4, from: 2600, to: 1600, ms: 30, level: 0.38 },
    { kind: "tone", wave: "sine", from: 900, to: 380, ms: 60, level: 0.14 },
    { at: 10, kind: "noise", filter: "bandpass", q: 1, from: 800, to: 2400, ms: 140, level: 0.08, attack: 30 },
  ],
  /** 딱: 알끼리 부딪힘 (충격 세기에 따라 크기·음높이 조절) */
  clack: [
    { kind: "noise", filter: "bandpass", q: 5, from: 2200, to: 1700, ms: 28, level: 0.36 },
    { kind: "tone", wave: "sine", from: 1100, to: 700, ms: 45, level: 0.12 },
  ],
  /** 휘릭↓ 툭: 알이 판 밖으로 떨어짐 */
  fall: [
    { kind: "tone", wave: "sine", from: 700, to: 160, ms: 260, level: 0.12 },
    { kind: "noise", filter: "bandpass", q: 1.2, from: 2000, to: 400, ms: 240, level: 0.14, attack: 40 },
    { at: 260, kind: "noise", filter: "lowpass", q: 1, from: 600, to: 150, ms: 90, level: 0.25 },
  ],
  /** 띠링: 내 차례가 됨 */
  myTurn: [
    { kind: "tone", wave: "sine", from: 660, to: 660, ms: 70, level: 0.08 },
    { at: 70, kind: "tone", wave: "sine", from: 880, to: 880, ms: 110, level: 0.08 },
  ],
} as const satisfies Record<string, readonly SoundLayer[]>;

/** 부딪힘 소리 사이 최소 간격(ms) */
export const CLACK_GAP_MS = 50;
/** 당기는 소리 사이 최소 간격(ms) */
export const STRETCH_GAP_MS = 70;
