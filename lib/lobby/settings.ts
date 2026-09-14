import { DEFAULT_LOBBY_SETTINGS, LOBBY_SETTINGS_STORAGE_KEY, SOUNDS } from "./constants";

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

export type LobbySound = "chat" | "swing" | "hit" | "step" | "sit" | "yawn" | "scratch" | "chomp" | "caught";

/** 효과음 한 겹. 여러 겹을 at(ms)만큼 늦춰 겹쳐서 한 소리를 만든다. from→to는 음 높이(tone) 또는 거르는 주파수(noise), Hz */
export type SoundLayer = { at?: number; ms: number; level: number; attack?: number; from: number; to: number } & (
  | { kind: "tone"; wave: OscillatorType }
  | { kind: "noise"; filter: BiquadFilterType; q: number }
);

let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;

// ponytail: 효과음 파일 없이 오실레이터·잡음으로 짧게 합성한다(저작권 걱정 없음). 효과음 파일이 생기면 여기서 AudioBuffer 재생으로 바꾼다
export function playSound(name: LobbySound, settings: LobbySettings) {
  if (settings.muted || settings.volume <= 0) return;
  try {
    audio ??= new AudioContext();
  } catch {
    return;
  }
  // 브라우저는 한 번 누르거나 키를 치기 전까지 소리를 막는다. 막혀 있으면 조용히 넘어간다
  if (audio.state === "suspended") audio.resume().catch(() => {});
  if (!noise) {
    noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  // 같은 소리를 계속 내도 기계음처럼 안 들리게 높낮이를 조금씩 흔든다
  const pitch = 0.92 + Math.random() * 0.16;
  for (const layer of SOUNDS[name]) {
    const start = audio.currentTime + (layer.at ?? 0) / 1000;
    const end = start + layer.ms / 1000;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(layer.level * settings.volume, start + (layer.attack ?? 10) / 1000);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(audio.destination);

    let source: AudioScheduledSourceNode;
    let frequency: AudioParam;
    if (layer.kind === "tone") {
      const oscillator = audio.createOscillator();
      oscillator.type = layer.wave;
      oscillator.connect(gain);
      source = oscillator;
      frequency = oscillator.frequency;
    } else {
      const buffer = audio.createBufferSource();
      buffer.buffer = noise;
      const filter = audio.createBiquadFilter();
      filter.type = layer.filter;
      filter.Q.value = layer.q;
      buffer.connect(filter);
      filter.connect(gain);
      source = buffer;
      frequency = filter.frequency;
    }
    frequency.setValueAtTime(layer.from * pitch, start);
    frequency.exponentialRampToValueAtTime(layer.to * pitch, end);
    source.start(start);
    source.stop(end + 0.02);
  }
}
