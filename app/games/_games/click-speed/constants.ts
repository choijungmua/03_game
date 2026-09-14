import type { SoundLayer } from "@/lib/lobby/settings";

/** 클릭 스피드 테스트에서만 쓰는 효과음 */
export const CLICK_SPEED_SOUNDS = {
  /** 딸깍: 연타 한 번. 빠르게 겹쳐도 거슬리지 않게 짧고 가볍게 */
  click: [
    { kind: "noise", filter: "highpass", q: 1, from: 2600, to: 1800, ms: 18, level: 0.14 },
    { kind: "tone", wave: "sine", from: 1500, to: 900, ms: 24, level: 0.05 },
  ],
  /** 삐―: 시간 끝 */
  timeUp: [
    { kind: "tone", wave: "square", from: 523, to: 523, ms: 320, level: 0.07 },
    { kind: "tone", wave: "sine", from: 1046, to: 1040, ms: 320, level: 0.08 },
  ],
} as const satisfies Record<string, readonly SoundLayer[]>;

/** 시간 끝 소리 뒤에 결과 소리가 이어지도록 미루는 시간 */
export const RESULT_SOUND_DELAY_MS = 380;

/** 이 등급 순서(CLICK_SPEED_TIERS 인덱스)부터는 결과 소리를 실패로 낸다 — "조금 느림"부터 */
export const FAIL_TIER_INDEX = 3;
