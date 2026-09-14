import type { SoundLayer } from "@/lib/lobby/settings";

/** 한 번에 여러 소리가 날 때 사이 간격(ms) */
export const SOUND_GAP_MS = 220;

export const BADUK_SOUNDS = {
  /** 딱(낮게): 상대·컴퓨터가 돌을 놓음 */
  opponentPlace: [
    { kind: "noise", filter: "bandpass", q: 3, from: 1500, to: 1100, ms: 40, level: 0.3 },
    { kind: "tone", wave: "sine", from: 560, to: 320, ms: 60, level: 0.11 },
  ],
  /** 달그락: 돌 한두 점 따냄 */
  capture: [
    { kind: "noise", filter: "bandpass", q: 4, from: 2600, to: 2000, ms: 30, level: 0.25 },
    { at: 70, kind: "noise", filter: "bandpass", q: 4, from: 2300, to: 1800, ms: 30, level: 0.2 },
    { at: 70, kind: "tone", wave: "sine", from: 880, to: 1175, ms: 120, level: 0.08 },
  ],
  /** 와르르: 세 점 이상 크게 따냄 */
  captureMany: [
    { kind: "noise", filter: "bandpass", q: 4, from: 2600, to: 2000, ms: 30, level: 0.28 },
    { at: 55, kind: "noise", filter: "bandpass", q: 4, from: 2200, to: 1700, ms: 30, level: 0.25 },
    { at: 110, kind: "noise", filter: "bandpass", q: 4, from: 2800, to: 2100, ms: 30, level: 0.22 },
    { at: 165, kind: "noise", filter: "bandpass", q: 4, from: 2000, to: 1500, ms: 30, level: 0.2 },
    { at: 220, kind: "noise", filter: "lowpass", q: 1, from: 1800, to: 400, ms: 180, level: 0.15 },
    { at: 120, kind: "tone", wave: "triangle", from: 660, to: 1320, ms: 260, level: 0.1 },
  ],
  /** 스윽: 패스 (돌 대신 차례만 넘김) */
  pass: [
    { kind: "noise", filter: "bandpass", q: 1.5, from: 1400, to: 700, ms: 180, level: 0.14, attack: 40 },
    { at: 60, kind: "tone", wave: "sine", from: 520, to: 440, ms: 140, level: 0.08 },
  ],
  /** 똑: 내 차례가 됨 (작게) */
  myTurn: [{ kind: "tone", wave: "sine", from: 1175, to: 1175, ms: 90, level: 0.07 }],
  /** 톡: 방을 만들고 상대를 기다림 */
  roomOpen: [
    { kind: "tone", wave: "sine", from: 660, to: 660, ms: 80, level: 0.1 },
    { at: 90, kind: "tone", wave: "sine", from: 880, to: 880, ms: 120, level: 0.1 },
  ],
  /** 툭↓: 기권 (돌을 판에 내려놓음) */
  resign: [
    { kind: "noise", filter: "lowpass", q: 1, from: 900, to: 200, ms: 140, level: 0.25 },
    { kind: "tone", wave: "triangle", from: 330, to: 196, ms: 260, level: 0.1 },
  ],
  /** 따닥따닥: 계가 (집 세기) */
  counting: [
    { kind: "noise", filter: "bandpass", q: 3, from: 1900, to: 1500, ms: 25, level: 0.18 },
    { at: 110, kind: "noise", filter: "bandpass", q: 3, from: 2000, to: 1600, ms: 25, level: 0.18 },
    { at: 220, kind: "noise", filter: "bandpass", q: 3, from: 2100, to: 1700, ms: 25, level: 0.18 },
    { at: 330, kind: "noise", filter: "bandpass", q: 3, from: 2200, to: 1800, ms: 25, level: 0.18 },
  ],
  /** 뚜: 관전 중 대국이 끝남 */
  finish: [
    { kind: "tone", wave: "triangle", from: 523, to: 523, ms: 140, level: 0.12 },
    { at: 130, kind: "tone", wave: "triangle", from: 784, to: 784, ms: 320, level: 0.12 },
  ],
} as const satisfies Record<string, readonly SoundLayer[]>;
