import type { SoundLayer } from "@/lib/lobby/settings";

/** 오목 전용 효과음 (공용 소리는 GAME_SOUNDS) */
export const GOMOKU_SOUNDS = {
  /** 톡↓: 상대가 둔 돌 (내 돌보다 낮고 부드럽게) */
  opponentPlace: [
    { kind: "noise", filter: "bandpass", q: 3, from: 1300, to: 900, ms: 40, level: 0.3 },
    { kind: "tone", wave: "sine", from: 520, to: 300, ms: 60, level: 0.12 },
  ],
  /** 띠링: 내 차례가 됨 */
  myTurn: [{ kind: "tone", wave: "sine", from: 1175, to: 1175, ms: 110, level: 0.06 }],
  /** 둥: 상대가 열린 셋을 만듦 */
  threatThree: [{ kind: "tone", wave: "triangle", from: 330, to: 310, ms: 160, level: 0.1 }],
  /** 반짝↑: 내가 넷을 만듦 (한 수면 이김) */
  chanceFour: [
    { kind: "tone", wave: "sine", from: 784, to: 784, ms: 80, level: 0.1 },
    { at: 70, kind: "tone", wave: "sine", from: 1175, to: 1175, ms: 140, level: 0.1 },
  ],
  /** 쓰으윽: 다섯 줄이 이어지며 빛남 */
  winLine: [
    { kind: "noise", filter: "bandpass", q: 2, from: 800, to: 4000, ms: 320, level: 0.14, attack: 80 },
    { kind: "tone", wave: "sine", from: 600, to: 1800, ms: 320, level: 0.08 },
  ],
  /** 뚜-뚜: 무승부 */
  draw: [
    { kind: "tone", wave: "triangle", from: 523, to: 523, ms: 160, level: 0.12 },
    { at: 180, kind: "tone", wave: "triangle", from: 523, to: 523, ms: 260, level: 0.12 },
  ],
} as const satisfies Record<string, readonly SoundLayer[]>;
