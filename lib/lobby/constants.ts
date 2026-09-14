import type { LobbySettings, LobbySound } from "./settings";

/** 이모지를 이어 붙이는 보이지 않는 문자(ZWJ). 지우면 가족·직업 이모지 같은 조합 이모지가 낱개로 흩어진다 (보이지 않는 글자라 코드값으로 쓴다) */
export const ZWJ = String.fromCharCode(0x200d);

export const DEFAULT_LOBBY_SETTINGS: LobbySettings = { muted: false, volume: 0.6, showHelp: true };

export const LOBBY_SETTINGS_STORAGE_KEY = "ggpli:lobby-settings";

/** 효과음 파일 없이 오실레이터로 합성하는 짧은 소리들 (주파수 Hz, 길이 ms, 최대 크기 0~1) */
export const SOUND_TONES: Record<LobbySound, { wave: OscillatorType; from: number; to: number; ms: number; level: number }> = {
  chat: { wave: "sine", from: 740, to: 1180, ms: 120, level: 0.18 },
  swing: { wave: "triangle", from: 420, to: 140, ms: 140, level: 0.16 },
  hit: { wave: "square", from: 180, to: 55, ms: 200, level: 0.12 },
};
