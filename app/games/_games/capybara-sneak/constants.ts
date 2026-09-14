import type { SoundLayer } from "@/lib/lobby/settings";

/** 몰래 먹기 전용 효과음 (playGameSound로 재생) */
export const SNEAK_SOUNDS = {
  /** 휙+흠?: 주인이 제대로 돌아봄 */
  look: [
    { kind: "noise", filter: "bandpass", q: 1.2, from: 2200, to: 500, ms: 180, level: 0.16, attack: 40 },
    { at: 120, kind: "tone", wave: "triangle", from: 330, to: 520, ms: 220, level: 0.1 },
  ],
  /** 휙: 주인이 흘끗 봄 */
  glance: [{ kind: "noise", filter: "bandpass", q: 1.5, from: 1800, to: 700, ms: 120, level: 0.12, attack: 30 }],
  /** 후우↓: 주인이 다시 등을 돌림(안도) */
  relief: [
    { kind: "noise", filter: "lowpass", q: 0.8, from: 1400, to: 300, ms: 260, level: 0.12, attack: 60 },
    { at: 60, kind: "tone", wave: "sine", from: 520, to: 330, ms: 240, level: 0.07 },
  ],
  /** 뿅↓: 손을 떼서 게이지가 줄기 시작 */
  shrink: [{ kind: "tone", wave: "triangle", from: 600, to: 300, ms: 160, level: 0.08 }],
  /** 챙: 수박이 반쯤 줄어 접시가 드러남 */
  half: [
    { kind: "tone", wave: "sine", from: 1760, to: 1760, ms: 180, level: 0.08 },
    { kind: "tone", wave: "sine", from: 2640, to: 2640, ms: 120, level: 0.05 },
  ],
  /** 아삭: 수박을 베어 씹음. 잘게 부서지는 잡음 여러 번 + 턱 울림 + 과즙 꼬리 */
  crunch: [
    { kind: "tone", wave: "sine", from: 170, to: 85, ms: 70, level: 0.14, attack: 3 },
    { kind: "noise", filter: "bandpass", q: 2.5, from: 3200, to: 2200, ms: 28, level: 0.34, attack: 2 },
    { at: 22, kind: "noise", filter: "bandpass", q: 3, from: 2400, to: 1600, ms: 24, level: 0.26, attack: 2 },
    { at: 44, kind: "noise", filter: "bandpass", q: 2.5, from: 2900, to: 1900, ms: 30, level: 0.3, attack: 2 },
    { at: 72, kind: "noise", filter: "bandpass", q: 3, from: 2000, to: 1300, ms: 22, level: 0.18, attack: 2 },
    { at: 80, kind: "noise", filter: "lowpass", q: 1, from: 1100, to: 400, ms: 110, level: 0.1, attack: 15 },
  ],
  /** 쩝: 접시 반대편으로 옮기며 입맛을 다심 */
  smack: [
    { kind: "noise", filter: "bandpass", q: 4, from: 1300, to: 2300, ms: 40, level: 0.14, attack: 3 },
    { at: 45, kind: "noise", filter: "lowpass", q: 1, from: 800, to: 300, ms: 120, level: 0.08, attack: 20 },
  ],
} as const satisfies Record<string, readonly SoundLayer[]>;
