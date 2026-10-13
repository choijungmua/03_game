import { useMemo, useSyncExternalStore } from "react";

import { DEFAULT_LOBBY_SETTINGS, LOBBY_SETTINGS_CHANGE_EVENT, LOBBY_SETTINGS_STORAGE_KEY, SOUNDS } from "./constants";

/** 로비 설정(효과음 켜고 끄기·크기, 조작법 안내 보기). 이 기기(localStorage)에만 저장한다 */
export interface LobbySettings {
  muted: boolean;
  /** 효과음 크기 0~1 */
  volume: number;
  showHelp: boolean;
}

function readRawSettings() {
  try {
    return localStorage.getItem(LOBBY_SETTINGS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseLobbySettings(raw: string | null): LobbySettings {
  try {
    const saved: Partial<LobbySettings> | null = JSON.parse(raw ?? "null");
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

export function loadLobbySettings(): LobbySettings {
  return parseLobbySettings(readRawSettings());
}

export function saveLobbySettings(settings: LobbySettings) {
  try {
    localStorage.setItem(LOBBY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
  window.dispatchEvent(new Event(LOBBY_SETTINGS_CHANGE_EVENT));
}

/**
 * 효과음 켜고 끄기 (로비 헤드폰·M 키·게임 화면 효과음 버튼 공통).
 * 음량이 0으로 저장돼 있으면 켜도 들리지 않아 다시 켤 방법이 없으므로, 켤 때는 기본 음량으로 되돌린다
 */
export function toggledSound(settings: LobbySettings): LobbySettings {
  if (!settings.muted && settings.volume > 0) return { ...settings, muted: true };
  return { ...settings, muted: false, volume: settings.volume > 0 ? settings.volume : DEFAULT_LOBBY_SETTINGS.volume };
}

/** 음량 슬라이더 (로비·멈춤 창 공통). 0이면 끄되 직전 음량은 남겨서 켜기 버튼으로 그 음량에 돌아온다 */
export function withVolume(settings: LobbySettings, volume: number): LobbySettings {
  return volume <= 0 ? { ...settings, muted: true } : { ...settings, muted: false, volume };
}

function subscribeSettings(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOBBY_SETTINGS_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOBBY_SETTINGS_CHANGE_EVENT, onChange);
  };
}

/** 저장된 설정을 구독한다. 서버 렌더에서는 기본값이라 하이드레이션이 어긋나지 않고, 어느 화면에서 저장하든 바로 따라 바뀐다 */
export function useLobbySettings(): LobbySettings {
  // 스냅숏은 문자열 그대로 비교해야 매 렌더 새 객체로 무한 렌더가 돌지 않는다
  const raw = useSyncExternalStore(subscribeSettings, readRawSettings, () => null);
  return useMemo(() => parseLobbySettings(raw), [raw]);
}

export type LobbySound =
  | "chat"
  | "swing"
  | "hit"
  | "step"
  | "stepDeck"
  | "stepMud"
  | "sit"
  | "yawn"
  | "scratch"
  | "chomp"
  | "caught"
  | "fishCast"
  | "fishBite"
  | "fishCatch"
  | "applePick"
  | "bathIn"
  | "bathOut"
  | "stepWater";

/** public/sfx/voice/<이름>.wav — 사람 목소리를 카피바라 캐릭터 목소리로 가공한 대사 (scripts/audio로 다시 만든다) */
export const VOICE_LINES = [
  "three", "two", "one", "go", "win", "lose", "record", "nice", "wow", "great", "oops", "ouch", "myturn",
  "timeup", "woah", "careful", "hup", "hurry", "yawn", "yum", "hi", "gotit", "ahh", "levelup", "yay",
] as const;
export type VoiceLine = (typeof VOICE_LINES)[number];

/**
 * 효과음 한 겹. 여러 겹을 at(ms)만큼 늦춰 겹쳐서 한 소리를 만든다.
 * from→to는 음 높이(tone), 거르는 주파수(noise), 목소리를 거르는 로우패스(voice), Hz.
 * pan은 왼쪽(-1)~오른쪽(1), wet은 울림(리버브)으로 보내는 양(0~1)
 */
export type SoundLayer = {
  at?: number;
  ms: number;
  level: number;
  attack?: number;
  from: number;
  to: number;
  pan?: number;
  wet?: number;
} & (
  | {
      kind: "tone";
      wave: OscillatorType;
      /** 같은 음을 ±센트만큼 어긋나게 세 겹 쌓아 두툼하게(유니즌) */
      detune?: number;
      /** FM: ratio배 음으로 흔들어 마림바·종·칼림바 같은 타악기 배음을 만든다 */
      fm?: { ratio: number; index: number };
      /** 로우패스를 이 Hz에서 시작해 끝으로 갈수록 닫아(필터 엔벨로프) 말랑하게 */
      lowpass?: number;
    }
  | { kind: "noise"; filter: BiquadFilterType; q: number; color?: "white" | "pink" | "brown" }
  | { kind: "voice"; line: VoiceLine }
);

type Bus = { input: GainNode; reverb: GainNode };
type NoiseColor = "white" | "pink" | "brown";

let audio: AudioContext | null = null;
let bus: Bus | null = null;
const noises = new Map<NoiseColor, AudioBuffer>();
const voices = new Map<VoiceLine, AudioBuffer | Promise<AudioBuffer | null>>();

/** 로비 효과음(걷기·펀치·맞기 등) 합성음 배율. 레이어 레벨이 0.1~0.3이라 같이 나는 목소리(0.7)에 묻혀서 키운다. 목소리·미니게임 소리는 그대로 */
export const LOBBY_SFX_BOOST = 2.5;

export function playSound(name: LobbySound, settings: LobbySettings) {
  playLayers(SOUNDS[name], settings, LOBBY_SFX_BOOST);
}

/** 게임 화면용: 로비에서 정한 소리 켜기·크기(이 기기 localStorage)를 매번 읽어 따른다. 게임별 소리는 각 게임 constants.ts에 SoundLayer[]로 둔다 */
export function playGameSound(layers: readonly SoundLayer[]) {
  playLayers(layers, loadLobbySettings());
}

function playLayers(layers: readonly SoundLayer[], settings: LobbySettings, boost = 1) {
  if (settings.muted || settings.volume <= 0) return;
  // 소리는 곁들이라 Web Audio가 어디서 예외를 던져도(오디오 장치 중단·잘못된 값 등) 부른 쪽으로 번지지 않게 삼킨다.
  // 번지면 알까기 샷 애니메이션이 끊겨 알이 잠기거나, 이펙트에서 나면 게임 화면이 오류 화면으로 바뀐다
  try {
    synthesize(layers, settings, boost);
  } catch {}
}

/**
 * 모든 소리가 지나는 마스터 버스: 레이어 → (마른 소리 + 짧은 방 울림) → 컴프레서 → 스피커.
 * 울림과 압축이 한 공간에서 나는 소리처럼 묶어 줘서, 날것의 비프음이 요즘 게임 소리처럼 들린다
 */
function masterBus(ctx: AudioContext): Bus {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.16;
  compressor.connect(ctx.destination);

  const input = ctx.createGain();
  input.connect(compressor);

  // 리버브 임펄스는 파일 없이 만든다: 좌우가 다른 잡음이 1.1초 동안 줄어들며 높은 소리부터 사라진다
  const length = Math.floor(ctx.sampleRate * 1.1);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    let smooth = 0;
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      smooth += (Math.random() * 2 - 1 - smooth) * (0.6 - 0.5 * t);
      data[i] = smooth * (1 - t) ** 3;
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  const reverb = ctx.createGain();
  reverb.gain.value = 0.9;
  reverb.connect(convolver);
  convolver.connect(compressor);
  return { input, reverb };
}

function noiseBuffer(ctx: AudioContext, color: NoiseColor) {
  const cached = noises.get(color);
  if (cached) return cached;
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // pink는 바람·물보라, brown은 쿵·우르릉처럼 낮게 깔리는 잡음 (white를 거르면 결이 거칠어 따로 만든다)
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (color === "pink") {
      b0 = 0.99765 * b0 + white * 0.099;
      b1 = 0.963 * b1 + white * 0.2965;
      b2 = 0.57 * b2 + white * 1.0526;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    } else if (color === "brown") {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else data[i] = white;
  }
  noises.set(color, buffer);
  return buffer;
}

/** 목소리 파일은 처음 소리를 낼 때 한꺼번에 받아 둔다 (모두 합쳐 0.5MB 아래) */
function loadVoice(ctx: AudioContext, line: VoiceLine): AudioBuffer | Promise<AudioBuffer | null> {
  const cached = voices.get(line);
  if (cached) return cached;
  const loading = fetch(`/sfx/voice/${line}.wav`)
    .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then((buffer) => {
      voices.set(line, buffer);
      return buffer;
    })
    .catch(() => {
      voices.delete(line);
      return null;
    });
  voices.set(line, loading);
  return loading;
}

function synthesize(layers: readonly SoundLayer[], settings: LobbySettings, boost: number) {
  audio ??= new AudioContext();
  const ctx = audio;
  // 브라우저는 한 번 누르거나 키를 치기 전까지 소리를 막는다. 막혀 있으면 조용히 넘어간다
  // iOS는 통화·앱 전환 뒤 "interrupted"로 두기도 해서, running이 아니면 다시 깨운다
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  const target = (bus ??= masterBus(ctx));
  if (voices.size === 0) for (const line of VOICE_LINES) void loadVoice(ctx, line);

  // 같은 소리를 계속 내도 기계음처럼 안 들리게 높낮이·크기·시작을 조금씩 흔든다
  const pitch = 0.94 + Math.random() * 0.12;
  const volume = settings.volume * (0.9 + Math.random() * 0.2);
  const requested = ctx.currentTime;
  for (const layer of layers) {
    const at = (layer.at ?? 0) / 1000 + Math.random() * 0.006;
    if (layer.kind !== "voice") {
      playLayer(ctx, target, layer, ctx.currentTime + at, pitch, volume * boost);
      continue;
    }
    const voice = loadVoice(ctx, layer.line);
    if (voice instanceof AudioBuffer) playVoice(ctx, target, layer, voice, ctx.currentTime + at, volume);
    // 아직 받는 중이면 0.3초 안에 오면 늦게라도 낸다 (그보다 늦으면 장면과 어긋나 버린다)
    else
      void voice.then((buffer) => {
        if (buffer && ctx.currentTime - requested < 0.3) playVoice(ctx, target, layer, buffer, ctx.currentTime + at, volume);
      });
  }
}

/** 레이어 소리 → 좌우 위치 → 마스터 버스(마른 소리) + 울림 */
function route(ctx: AudioContext, target: Bus, node: AudioNode, layer: SoundLayer, defaultWet: number) {
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, layer.pan ?? 0));
  node.connect(panner);
  panner.connect(target.input);
  const send = ctx.createGain();
  send.gain.value = layer.wet ?? defaultWet;
  panner.connect(send);
  send.connect(target.reverb);
}

function playVoice(
  ctx: AudioContext,
  target: Bus,
  layer: Extract<SoundLayer, { kind: "voice" }>,
  buffer: AudioBuffer,
  start: number,
  volume: number,
) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  // 목소리는 반음 안쪽으로만 흔든다. 더 흔들면 말투가 어색해진다
  source.playbackRate.value = 0.97 + Math.random() * 0.06;
  const end = start + Math.min(layer.ms / 1000, buffer.duration / source.playbackRate.value);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(layer.from, start);
  filter.frequency.exponentialRampToValueAtTime(layer.to, end);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(layer.level * volume, start + (layer.attack ?? 5) / 1000);
  gain.gain.setValueAtTime(layer.level * volume, Math.max(start + 0.006, end - 0.04));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(filter);
  filter.connect(gain);
  route(ctx, target, gain, layer, 0.1);
  source.start(start);
  source.stop(end + 0.02);
}

function playLayer(
  ctx: AudioContext,
  target: Bus,
  layer: Exclude<SoundLayer, { kind: "voice" }>,
  start: number,
  pitch: number,
  volume: number,
) {
  const end = start + layer.ms / 1000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(layer.level * volume, start + (layer.attack ?? 8) / 1000);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  route(ctx, target, gain, layer, 0.14);

  const sweep = (param: AudioParam, multiplier = 1) => {
    param.setValueAtTime(layer.from * pitch * multiplier, start);
    param.exponentialRampToValueAtTime(layer.to * pitch * multiplier, end);
  };
  const sources: AudioScheduledSourceNode[] = [];

  if (layer.kind === "tone") {
    let output: AudioNode = gain;
    if (layer.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 0.8;
      filter.frequency.setValueAtTime(layer.lowpass, start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(layer.lowpass * 0.25, 80), end);
      filter.connect(gain);
      output = filter;
    }
    const spread = layer.detune ? [-layer.detune, 0, layer.detune] : [0];
    for (const cents of spread) {
      const oscillator = ctx.createOscillator();
      oscillator.type = layer.wave;
      oscillator.detune.value = cents;
      sweep(oscillator.frequency);
      if (layer.fm) {
        // 흔드는 깊이가 소리 끝으로 갈수록 줄어 "통-" 하고 맑게 남는다 (실제 나무·쇠 타악기처럼)
        const modulator = ctx.createOscillator();
        sweep(modulator.frequency, layer.fm.ratio);
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(layer.from * pitch * layer.fm.index, start);
        depth.gain.exponentialRampToValueAtTime(Math.max(layer.to * pitch * layer.fm.index * 0.05, 0.01), end);
        modulator.connect(depth);
        depth.connect(oscillator.frequency);
        sources.push(modulator);
      }
      if (spread.length > 1) {
        const unison = ctx.createGain();
        unison.gain.value = 0.55;
        oscillator.connect(unison);
        unison.connect(output);
      } else oscillator.connect(output);
      sources.push(oscillator);
    }
  } else {
    const buffer = ctx.createBufferSource();
    buffer.buffer = noiseBuffer(ctx, layer.color ?? "white");
    buffer.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = layer.filter;
    filter.Q.value = layer.q;
    sweep(filter.frequency);
    buffer.connect(filter);
    filter.connect(gain);
    sources.push(buffer);
  }
  for (const source of sources) {
    source.start(start);
    source.stop(end + 0.02);
  }
}

