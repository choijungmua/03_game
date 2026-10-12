import type { SoundLayer } from "@/lib/lobby/settings";

// 카피바라 런 효과음. 각진 파형(square·sawtooth) 대신 사인파·부드럽게 걸러낸 잡음만 써서
// 8비트 "딸각" 느낌 없이 둥글고 가볍게 들리게 한다. attack(ms)으로 소리 머리를 둥글린다
export const RUN_SOUNDS = {
  /** 휙: 점프 — 짧은 바람 소리 + 낮은 퐁 */
  jump: [
    { kind: "noise", filter: "bandpass", q: 0.8, from: 500, to: 1400, ms: 180, level: 0.07, attack: 30 },
    { kind: "tone", wave: "sine", from: 320, to: 520, ms: 140, level: 0.06, attack: 15 },
  ],
  /** 휘리릭: 2단 점프 덤블링 — 위로 감기는 바람 */
  double: [
    { kind: "noise", filter: "bandpass", q: 1.4, from: 600, to: 2600, ms: 320, level: 0.09, attack: 60 },
    { kind: "tone", wave: "sine", from: 440, to: 880, ms: 260, level: 0.05, attack: 40 },
  ],
  /** 툭: 착지 — 먹먹한 저음 */
  land: [{ kind: "noise", filter: "lowpass", q: 0.7, from: 500, to: 120, ms: 110, level: 0.12, attack: 5 }],
  /** 띠링: 코인 — 맑은 두 음 + 배음 */
  coin: [
    { kind: "tone", wave: "sine", from: 1319, to: 1319, ms: 90, level: 0.07, attack: 4 },
    { at: 55, kind: "tone", wave: "sine", from: 1976, to: 1976, ms: 220, level: 0.07, attack: 4 },
    { at: 55, kind: "tone", wave: "sine", from: 3951, to: 3951, ms: 160, level: 0.015, attack: 4 },
  ],
  /** 반짝반짝 상승 아르페지오: 코인 묶음 보너스 */
  bonus: [
    { kind: "tone", wave: "sine", from: 1047, to: 1047, ms: 160, level: 0.07, attack: 6 },
    { at: 80, kind: "tone", wave: "sine", from: 1319, to: 1319, ms: 160, level: 0.07, attack: 6 },
    { at: 160, kind: "tone", wave: "sine", from: 1568, to: 1568, ms: 160, level: 0.07, attack: 6 },
    { at: 240, kind: "tone", wave: "sine", from: 2093, to: 2093, ms: 420, level: 0.08, attack: 6 },
    { at: 240, kind: "noise", filter: "highpass", q: 0.7, from: 6000, to: 9000, ms: 400, level: 0.03, attack: 40 },
  ],
  /** 팅: 철봉 잡기 — 쇠 울림 */
  grab: [
    { kind: "tone", wave: "sine", from: 1760, to: 1740, ms: 260, level: 0.05, attack: 3 },
    { kind: "tone", wave: "sine", from: 2637, to: 2620, ms: 200, level: 0.025, attack: 3 },
    { kind: "noise", filter: "lowpass", q: 0.7, from: 400, to: 200, ms: 70, level: 0.06 },
  ],
  /** 퍽: 부딪힘 — 둔탁하게 */
  hurt: [
    { kind: "noise", filter: "lowpass", q: 0.9, from: 900, to: 150, ms: 200, level: 0.18, attack: 4 },
    { kind: "tone", wave: "sine", from: 220, to: 90, ms: 220, level: 0.1, attack: 4 },
  ],
  /** 휘이잉↓: 낭떠러지로 떨어짐 */
  fall: [
    { kind: "tone", wave: "sine", from: 880, to: 180, ms: 600, level: 0.07, attack: 20 },
    { kind: "noise", filter: "bandpass", q: 1, from: 1600, to: 300, ms: 600, level: 0.05, attack: 40 },
  ],
  /** 뽀잉: 버섯 점프 */
  spring: [
    { kind: "tone", wave: "sine", from: 180, to: 760, ms: 260, level: 0.09, attack: 6 },
    { kind: "tone", wave: "sine", from: 360, to: 1500, ms: 200, level: 0.03, attack: 6 },
  ],
  /** 하트 회복 — 따뜻한 두 음 */
  heart: [
    { kind: "tone", wave: "sine", from: 784, to: 784, ms: 140, level: 0.07, attack: 10 },
    { at: 110, kind: "tone", wave: "sine", from: 1175, to: 1175, ms: 280, level: 0.07, attack: 10 },
  ],
  /** 스테이지 시작·보너스 타임 — 밝은 팡파르 */
  stage: [
    { kind: "tone", wave: "triangle", from: 784, to: 784, ms: 140, level: 0.07, attack: 8 },
    { at: 120, kind: "tone", wave: "triangle", from: 988, to: 988, ms: 140, level: 0.07, attack: 8 },
    { at: 240, kind: "tone", wave: "triangle", from: 1175, to: 1175, ms: 140, level: 0.07, attack: 8 },
    { at: 360, kind: "tone", wave: "sine", from: 1568, to: 1568, ms: 520, level: 0.08, attack: 8 },
    { at: 360, kind: "noise", filter: "highpass", q: 0.7, from: 6000, to: 9000, ms: 500, level: 0.03, attack: 60 },
  ],
  /** 장애물 통과 — 아주 가볍게 */
  pass: [{ kind: "tone", wave: "sine", from: 988, to: 1175, ms: 120, level: 0.035, attack: 8 }],
  /** 게임 끝 — 내려가는 부드러운 세 음 */
  over: [
    { kind: "tone", wave: "triangle", from: 523, to: 523, ms: 260, level: 0.07, attack: 20 },
    { at: 220, kind: "tone", wave: "triangle", from: 440, to: 440, ms: 260, level: 0.07, attack: 20 },
    { at: 440, kind: "tone", wave: "triangle", from: 349, to: 330, ms: 600, level: 0.07, attack: 20 },
  ],
} as const satisfies Record<string, readonly SoundLayer[]>;
