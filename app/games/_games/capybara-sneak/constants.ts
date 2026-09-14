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
  /** 콩: 접시 반대편으로 폴짝 */
  hop: [{ kind: "tone", wave: "sine", from: 380, to: 620, ms: 60, level: 0.05 }],
} as const satisfies Record<string, readonly SoundLayer[]>;
