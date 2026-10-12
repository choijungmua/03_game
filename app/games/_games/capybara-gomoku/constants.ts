import { GAME_SOUNDS } from "@/lib/games/constants";
import type { SoundLayer } from "@/lib/lobby/settings";

/** 오목 전용 효과음 (공용 소리는 GAME_SOUNDS) */
export const GOMOKU_SOUNDS = {
  /** 딱(조금 낮게): 상대가 둔 돌 — 진짜 바둑돌 클릭 + 나무판 울림, 내 돌보다 낮고 부드럽게 */
  opponentPlace: [
    { kind: "noise", filter: "bandpass", q: 4, from: 2200, to: 1500, ms: 26, level: 0.28, attack: 1, wet: 0.06 },
    { kind: "tone", wave: "sine", from: 540, to: 500, ms: 100, level: 0.12, attack: 1, fm: { ratio: 2.76, index: 0.8 }, wet: 0.06 },
    { kind: "tone", wave: "sine", from: 150, to: 110, ms: 70, level: 0.07, attack: 1 },
  ],
  /** 내 차례!: 공용 소리 (칼림바 + 목소리) */
  myTurn: GAME_SOUNDS.myTurn,
  /** 둥: 상대가 열린 셋을 만듦 — 낮은 나무 북 */
  threatThree: [{ kind: "tone", wave: "sine", from: 220, to: 210, ms: 260, level: 0.13, attack: 2, fm: { ratio: 2.76, index: 1.2 }, wet: 0.2 }],
  /** 반짝↑: 내가 넷을 만듦 (한 수면 이김) — 칼림바 두 음 */
  chanceFour: [
    { kind: "tone", wave: "sine", from: 784, to: 784, ms: 180, level: 0.1, attack: 2, fm: { ratio: 3.5, index: 0.6 }, pan: -0.2, wet: 0.2 },
    { at: 80, kind: "tone", wave: "sine", from: 1175, to: 1175, ms: 260, level: 0.1, attack: 2, fm: { ratio: 3.5, index: 0.6 }, pan: 0.2, wet: 0.25 },
  ],
  /** 쓰으윽 찰랑: 다섯 줄이 이어지며 빛남 */
  winLine: [
    { kind: "noise", filter: "bandpass", q: 2, from: 800, to: 5000, ms: 320, level: 0.12, attack: 80, color: "pink", wet: 0.3 },
    { kind: "tone", wave: "sine", from: 600, to: 1800, ms: 320, level: 0.06, detune: 10, lowpass: 3000 },
    { at: 300, kind: "tone", wave: "sine", from: 2093, to: 2093, ms: 400, level: 0.07, attack: 2, fm: { ratio: 3.5, index: 0.5 }, wet: 0.4 },
  ],
  /** 뚜-뚜: 무승부 — 마림바 같은 음 두 번 */
  draw: [
    { kind: "tone", wave: "sine", from: 523, to: 523, ms: 220, level: 0.13, attack: 2, fm: { ratio: 4, index: 0.7 }, wet: 0.2 },
    { at: 200, kind: "tone", wave: "sine", from: 523, to: 523, ms: 320, level: 0.13, attack: 2, fm: { ratio: 4, index: 0.7 }, wet: 0.25 },
  ],
} as const satisfies Record<string, readonly SoundLayer[]>;
