import { DEFAULT_LOBBY_SETTINGS, LOBBY_SETTINGS_STORAGE_KEY, SOUND_TONES } from "./constants";

/** 로비 설정(효과음 켜고 끄기·크기, 조작법 안내 보기). 이 기기(localStorage)에만 저장한다 */
export interface LobbySettings {
  muted: boolean;
  /** 효과음 크기 0~1 */
  volume: number;
  showHelp: boolean;
}

export function loadLobbySettings(): LobbySettings {
  try {
    const saved: Partial<LobbySettings> | null = JSON.parse(localStorage.getItem(LOBBY_SETTINGS_STORAGE_KEY) ?? "null");
    const { muted, volume, showHelp } = saved ?? {};
    return {
      muted: typeof muted === "boolean" ? muted : DEFAULT_LOBBY_SETTINGS.muted,
      volume: typeof volume === "number" && volume >= 0 && volume <= 1 ? volume : DEFAULT_LOBBY_SETTINGS.volume,
      showHelp: typeof showHelp === "boolean" ? showHelp : DEFAULT_LOBBY_SETTINGS.showHelp,
    };
  } catch {
    return DEFAULT_LOBBY_SETTINGS;
  }
}

export function saveLobbySettings(settings: LobbySettings) {
  try {
    localStorage.setItem(LOBBY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export type LobbySound = "chat" | "swing" | "hit";

let audio: AudioContext | null = null;

// ponytail: 효과음 파일 없이 오실레이터로 짧게 합성한다. 효과음 파일이 생기면 여기서 AudioBuffer 재생으로 바꾼다
export function playSound(name: LobbySound, settings: LobbySettings) {
  if (settings.muted || settings.volume <= 0) return;
  try {
    audio ??= new AudioContext();
  } catch {
    return;
  }
  // 브라우저는 한 번 누르거나 키를 치기 전까지 소리를 막는다. 막혀 있으면 조용히 넘어간다
  if (audio.state === "suspended") audio.resume().catch(() => {});
  const tone = SOUND_TONES[name];
  const start = audio.currentTime;
  const end = start + tone.ms / 1000;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(tone.level * settings.volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(audio.destination);
  const oscillator = audio.createOscillator();
  oscillator.type = tone.wave;
  oscillator.frequency.setValueAtTime(tone.from, start);
  oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
  oscillator.connect(gain);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}
