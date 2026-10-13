import { GAME_SOUNDS } from "@/lib/games/constants";
import type { SoundLayer } from "@/lib/lobby/settings";

/** 알까기 전용 효과음 (나무 알·나무판 질감). 여러 게임이 같이 쓰는 소리는 GAME_SOUNDS(@/lib/games/constants)에서 꺼내 쓴다 */
export const ALKKAGI_SOUNDS = {
  /** 꾹: 알을 손가락으로 집음 — 손끝 마찰 + 나무 알 살짝 */
  grab: [
    { kind: "noise", filter: "bandpass", q: 2, from: 1200, to: 700, ms: 40, level: 0.16, attack: 2, color: "pink" },
    { kind: "tone", wave: "sine", from: 420, to: 380, ms: 60, level: 0.08, attack: 1, fm: { ratio: 2.76, index: 0.4 } },
  ],
  /** 끼릭: 뒤로 당기는 고무줄 (힘에 따라 음을 올려서 재생) */
  stretch: [
    { kind: "tone", wave: "triangle", from: 220, to: 245, ms: 50, level: 0.045, detune: 8, lowpass: 1800 },
    { kind: "noise", filter: "bandpass", q: 6, from: 1800, to: 2200, ms: 45, level: 0.03 },
  ],
  /** 톡: 방향키로 조준·힘 조절 — 작은 나무 틱 */
  aim: [{ kind: "tone", wave: "sine", from: 1300, to: 1250, ms: 30, level: 0.06, attack: 1, fm: { ratio: 2.76, index: 0.5 } }],
  /** 따악: 손가락으로 알을 튕김 (힘에 따라 크기 조절) — 손톱 스냅 + 나무 몸통 + 미끄러지는 바람 */
  flick: [
    { kind: "noise", filter: "bandpass", q: 4, from: 3200, to: 2000, ms: 22, level: 0.36, attack: 1 },
    { kind: "tone", wave: "sine", from: 760, to: 600, ms: 80, level: 0.13, attack: 1, fm: { ratio: 2.76, index: 1 }, wet: 0.06 },
    { at: 10, kind: "noise", filter: "bandpass", q: 1, from: 700, to: 2200, ms: 150, level: 0.06, attack: 30, color: "pink" },
  ],
  /** 딱: 나무 알끼리 부딪힘 (충격 세기에 따라 크기·음높이 조절) */
  clack: [
    { kind: "noise", filter: "bandpass", q: 5, from: 2800, to: 2200, ms: 20, level: 0.34, attack: 1 },
    { kind: "tone", wave: "sine", from: 980, to: 900, ms: 70, level: 0.13, attack: 1, fm: { ratio: 2.76, index: 1.1 }, wet: 0.08 },
  ],
  /** 휘릭↓ 툭: 알이 판 밖으로 떨어짐 — 바람 + 바닥에 떨어지는 둔탁한 소리 */
  fall: [
    { kind: "noise", filter: "bandpass", q: 1.2, from: 2400, to: 500, ms: 240, level: 0.13, attack: 30, color: "pink" },
    { kind: "tone", wave: "sine", from: 620, to: 180, ms: 240, level: 0.07, lowpass: 1500 },
    { at: 250, kind: "noise", filter: "lowpass", q: 1, from: 900, to: 150, ms: 110, level: 0.26, attack: 1, color: "brown", wet: 0.12 },
    { at: 250, kind: "tone", wave: "sine", from: 260, to: 200, ms: 90, level: 0.1, attack: 1, fm: { ratio: 2.76, index: 0.6 } },
  ],
  /** 내 차례!: 공용 소리 (칼림바 + 목소리) */
  myTurn: GAME_SOUNDS.myTurn,
  /** 앗!: 내 알이 떨어짐 (fall에 덧붙임) */
  myFall: [{ at: 120, kind: "voice", line: "oops", from: 9000, to: 6000, ms: 500, level: 0.7 }],
} as const satisfies Record<string, readonly SoundLayer[]>;

/** 부딪힘 소리 사이 최소 간격(ms) */
export const CLACK_GAP_MS = 50;
/** 당기는 소리 사이 최소 간격(ms) */
export const STRETCH_GAP_MS = 70;
