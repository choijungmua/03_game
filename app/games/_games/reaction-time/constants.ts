import type { SoundLayer } from "@/lib/lobby/settings";

/** 딱!: 올라가는 숫자를 멈추는 누름 */
export const STOP_SOUND: readonly SoundLayer[] = [
  { kind: "noise", filter: "highpass", q: 1, from: 4000, to: 2500, ms: 30, level: 0.3 },
  { kind: "tone", wave: "square", from: 1800, to: 900, ms: 50, level: 0.08 },
];
