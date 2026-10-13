import { GAME_SOUNDS } from "@/lib/games/constants";
import type { SoundLayer } from "@/lib/lobby/settings";

/** 한 번에 여러 소리가 날 때 사이 간격(ms) */
export const SOUND_GAP_MS = 220;

/** 돌 하나 줍는 달그락 (돌끼리 스치는 맑은 클릭) */
const clink = (at: number, from: number, level: number, pan = 0) =>
  ({ at, kind: "noise", filter: "bandpass", q: 5, from, to: from * 0.8, ms: 18, level, attack: 3, pan }) as const;

export const BADUK_SOUNDS = {
  /** 딱(조금 낮게): 상대·컴퓨터가 돌을 놓음 — 진짜 바둑돌 클릭 + 비자나무 판 울림 */
  opponentPlace: [
    { kind: "noise", filter: "bandpass", q: 4, from: 2400, to: 1600, ms: 26, level: 0.28, attack: 3, wet: 0.06 },
    { kind: "tone", wave: "sine", from: 560, to: 520, ms: 100, level: 0.12, attack: 3, fm: { ratio: 2.76, index: 0.8 }, wet: 0.06 },
    { kind: "tone", wave: "sine", from: 150, to: 110, ms: 70, level: 0.07, attack: 3 },
  ],
  /** 달그락: 돌 한두 점 따냄 */
  capture: [
    clink(0, 3400, 0.22, -0.2),
    clink(60, 3000, 0.18, 0.2),
    { at: 70, kind: "tone", wave: "sine", from: 880, to: 880, ms: 200, level: 0.07, attack: 4, fm: { ratio: 3.5, index: 0.5 }, wet: 0.15 },
  ],
  /** 와르르 좋아!: 세 점 이상 크게 따냄 — 돌 쏟아지는 소리 + 칭찬 목소리 */
  captureMany: [
    clink(0, 3400, 0.24, -0.4),
    clink(50, 2900, 0.22, 0.3),
    clink(95, 3600, 0.2, -0.1),
    clink(140, 2700, 0.2, 0.4),
    clink(180, 3200, 0.17, -0.3),
    { at: 200, kind: "noise", filter: "bandpass", q: 1, from: 2500, to: 900, ms: 200, level: 0.1, color: "pink", wet: 0.1 },
    ...(GAME_SOUNDS.praise as readonly SoundLayer[]).map((layer) => ({ ...layer, at: (layer.at ?? 0) + 260 })),
  ],
  /** 스윽: 패스 (돌 대신 차례만 넘김) — 통 뚜껑 미끄러짐 */
  pass: [
    { kind: "noise", filter: "bandpass", q: 1.5, from: 1400, to: 700, ms: 200, level: 0.13, attack: 40, color: "pink" },
    { at: 150, kind: "tone", wave: "sine", from: 420, to: 400, ms: 120, level: 0.08, attack: 3, fm: { ratio: 2.76, index: 0.6 } },
  ],
  /** 내 차례!: 공용 소리 (칼림바 + 목소리) */
  myTurn: GAME_SOUNDS.myTurn,
  /** 톡톡: 방을 만들고 상대를 기다림 — 칼림바 두 음 */
  roomOpen: [
    { kind: "tone", wave: "sine", from: 660, to: 660, ms: 180, level: 0.1, attack: 4, fm: { ratio: 3.5, index: 0.5 }, wet: 0.2 },
    { at: 100, kind: "tone", wave: "sine", from: 880, to: 880, ms: 260, level: 0.1, attack: 4, fm: { ratio: 3.5, index: 0.5 }, wet: 0.25 },
  ],
  /** 툭↓: 기권 (돌을 판에 힘없이 내려놓음) */
  resign: [
    { kind: "noise", filter: "lowpass", q: 1, from: 1200, to: 200, ms: 120, level: 0.22, attack: 3, color: "brown" },
    { kind: "tone", wave: "sine", from: 300, to: 220, ms: 280, level: 0.11, attack: 3, fm: { ratio: 2.76, index: 0.7 }, wet: 0.2 },
  ],
  /** 따닥따닥: 계가 (집 세며 돌을 옮김) */
  counting: [clink(0, 2600, 0.18, -0.3), clink(110, 2800, 0.18, -0.1), clink(220, 2700, 0.18, 0.1), clink(330, 3000, 0.18, 0.3)],
  /** 뎅: 관전 중 대국이 끝남 — 마림바 두 음 */
  finish: [
    { kind: "tone", wave: "sine", from: 523, to: 523, ms: 220, level: 0.13, attack: 4, fm: { ratio: 4, index: 0.7 }, wet: 0.2 },
    { at: 140, kind: "tone", wave: "sine", from: 784, to: 784, ms: 420, level: 0.13, attack: 4, fm: { ratio: 4, index: 0.7 }, wet: 0.3 },
  ],
} as const satisfies Record<string, readonly SoundLayer[]>;
