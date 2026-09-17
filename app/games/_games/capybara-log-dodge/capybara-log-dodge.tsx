"use client";

import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";

import { GameControls } from "@/components/games/game-controls";
import { GameOverActions } from "@/components/games/game-over-actions";
import { ShareButton } from "@/components/games/share-button";
import { cn } from "@/lib";
import { GAME_SOUNDS, GAME_TITLES } from "@/lib/games/constants";
import { submitGameRecord } from "@/lib/games/game-events";
import { useInView } from "@/lib/games/use-in-view";
import { useLockPageScroll } from "@/lib/games/use-lock-page-scroll";
import { lobbyAssetSrc } from "@/lib/lobby/assets";
import { SOUNDS } from "@/lib/lobby/constants";
import { playGameSound } from "@/lib/lobby/settings";

import {
  BEAT_BPM,
  BEAT_HAT,
  BEAT_KICK,
  BEAT_SNARE,
  BOUNCE_SOUND,
  COMBO_SOUNDS,
  DUCK_CUE_SOUND,
  DUCK_SOUND,
  JUMP_CUE_SOUND,
  JUMP_SOUND,
  LAND_SOUND,
  LEVEL_UP_SOUND,
  PACE_SOUNDS,
  PICKUP_SPAWN_SOUND,
  SHIELD_BREAK_SOUND,
  SHIELD_GET_SOUND,
  SPLIT_SOUND,
  STEP_SOUND_MS,
  TIER_UP_SOUND,
  WAVE_SOUNDS,
} from "./constants";
import { LogDodgeLeaderboard } from "./leaderboard";
import {
  CAPYBARA_Y,
  COMBO_SHIELD_AT,
  createRandom,
  createState,
  formatSeconds,
  GAME_HEIGHT,
  GAME_WIDTH,
  type GameState,
  getCourseDate,
  getCue,
  getDeathLine,
  getDifficulty,
  JUMP_MS,
  type Log,
  LOG_HEIGHTS,
  LOG_THICKNESS,
  LOG_UNLOCK_MS,
  type LogKind,
  parseChallenge,
  PEAK_MS,
  PICKUP_RADIUS,
  seedFromText,
  step,
} from "./logic";
import { getCourseBest, getRank, insertRecord, saveRecords, useLogDodgeRecords } from "./records";
import { getLogDodgeTier } from "./tiers";

export const COUNTDOWN_VALUES = [3, 2, 1] as const;
export const COUNTDOWN_STEP_MS = 800;
/** 맞은 뒤 납작해진 카피바라를 보여주는 시간 */
const HIT_PAUSE_MS = 700;
const FLASH_MS = 700;
const RUN_FRAME_MS = 90;
const CAPYBARA_SIZE = 84;
/** 점프 꼭대기에서 그림이 떠오르는 높이(px) */
const JUMP_HEIGHT = 36;
/** 머리 높이 통나무를 땅(그림자)보다 위로 띄워 그리는 높이(px) — 바닥 통나무와 한눈에 구분되게 크게 */
const BEAM_LIFT = 42;
/** 이 시간 동안 화면에 "유자 보호막!"/"막았어요!" 글자 */
const SHIELD_FLASH_MS = 900;
const TILE_SIZE = 96;
/** 배경이 아래로 흘러가는 속도(px/s) — 카피바라가 위로 달리는 느낌 */
const SCROLL_SPEED = 180;
/** 위·아래로 이만큼(CSS px) 쓸면 점프·숙이기 */
const SWIPE_PX = 36;
/** 이보다 짧고 적게 움직인 터치는 탭(점프)으로 본다 */
const TAP_MS = 250;
const TAP_PX = 10;
/** 화면 흔들림 최대 폭(px). 배경을 이만큼 더 넓게 깔아 흔들려도 가장자리가 비지 않는다 */
const SHAKE_MAX_PX = 10;
/** 착지할 때 납작하게 찌그러지는 시간 */
const LAND_SQUASH_MS = 140;
/** 좌우로 달릴 때 몸이 기우는 각도(rad) */
const LEAN_TILT = 0.16;
/** 파티클이 떨어지는 가속도(px/s²) */
const PARTICLE_GRAVITY = 900;
const SPEED_LINE_COUNT = 14;

const TITLE = GAME_TITLES["capybara-log-dodge"];
const LEFT_KEYS = new Set(["ArrowLeft", "a", "A"]);
const RIGHT_KEYS = new Set(["ArrowRight", "d", "D"]);
const JUMP_KEYS = new Set(["ArrowUp", "w", "W", " "]);
const DUCK_KEYS = new Set(["ArrowDown", "s", "S"]);

const CHARACTER_BASE = "/assets/images/characters/capybara";
const MEADOW_SRC = lobbyAssetSrc({ category: "ground", id: "meadow" });
/** 로비 통나무 의자 그림에서 다리를 뺀 통나무 몸통 부분(원본 px) */
const LOG_SOURCE = { width: 384, height: 98 };
const RUN_FRAMES = ["walk1", "stand", "walk2", "stand"] as const;
const RUN_FACINGS = ["up-left", "up", "up-right"] as const;

type Phase = "idle" | "countdown" | "playing" | "result";
type Mode = "daily" | "practice";

interface RoundResult {
  timeMs: number;
  nearMisses: number;
  hitBy: LogKind;
  course: string | null;
  recordId: string;
  rank: number;
}

interface Hud {
  tenths: number;
  nearMisses: number;
  combo: number;
  nearMissFlash: boolean;
  passedFlash: boolean;
  cue: ReturnType<typeof getCue>;
  shield: boolean;
  /** combo: 아슬아슬 콤보 보상으로 받은 보호막 */
  shieldFlash: "get" | "combo" | "block" | null;
}

/** 캔버스 색은 하드코딩하지 않고 토큰 값을 읽는다 (플레이 영역은 .dark 범위) */
interface Palette {
  shadow: string;
  text: string;
  /** 점프(바닥 통나무)는 노랑, 숙이기(머리 위 통나무)는 파랑 — 안내 글자·버튼과 같은 색 */
  jump: string;
  duck: string;
  fast: string;
  /** 흙먼지·나무 조각 파티클 */
  dust: string;
  wood: string;
  font: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
  size: number;
  color: string;
}

/** 판정과 상관없는 화면 연출. 움직임 줄이기 설정이면 만들지 않는다 */
interface Effects {
  particles: Particle[];
  shakeMs: number;
  shakeTotalMs: number;
  shakePx: number;
  /** 남은 착지 찌그러짐 시간 */
  landMs: number;
  /** 지금 몸 기울기(rad). 좌우 입력 쪽으로 부드럽게 따라간다 */
  tilt: number;
}

function createEffects(): Effects {
  return { particles: [], shakeMs: 0, shakeTotalMs: 1, shakePx: 0, landMs: 0, tilt: 0 };
}

/** (x, y)에서 파티클을 흩뿌린다. up이면 위쪽 반원으로만 (흙먼지) */
function burst(effects: Effects, x: number, y: number, color: string, count: number, speed: number, up = false) {
  for (let i = 0; i < count; i += 1) {
    const angle = up ? -Math.PI * Math.random() : Math.PI * 2 * Math.random();
    const power = speed * (0.4 + 0.6 * Math.random());
    effects.particles.push({
      x,
      y,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      ageMs: 0,
      lifeMs: 350 + 250 * Math.random(),
      size: 3 + 4 * Math.random(),
      color,
    });
  }
}

function shake(effects: Effects, px: number, ms: number) {
  if (effects.shakeMs > 0 && effects.shakePx > px) return;
  effects.shakePx = px;
  effects.shakeMs = ms;
  effects.shakeTotalMs = ms;
}

function stepEffects(effects: Effects, dtMs: number, lean: number) {
  const seconds = dtMs / 1000;
  effects.shakeMs = Math.max(0, effects.shakeMs - dtMs);
  effects.landMs = Math.max(0, effects.landMs - dtMs);
  effects.tilt += (lean * LEAN_TILT - effects.tilt) * Math.min(1, dtMs / 90);
  for (const particle of effects.particles) {
    particle.ageMs += dtMs;
    particle.x += particle.vx * seconds;
    particle.vy += PARTICLE_GRAVITY * seconds;
    particle.y += particle.vy * seconds;
  }
  effects.particles = effects.particles.filter((particle) => particle.ageMs < particle.lifeMs);
}

type Sprites = Record<string, HTMLImageElement>;

function loadSprites(): Sprites {
  const sprites: Sprites = {};
  const add = (key: string, src: string) => {
    const image = new window.Image();
    image.src = src;
    sprites[key] = image;
  };
  for (const frame of ["walk1", "walk2", "stand"]) {
    for (const facing of RUN_FACINGS) add(`${frame}-${facing}`, `${CHARACTER_BASE}/capybara-${frame}-${facing}.webp`);
  }
  add("stun", `${CHARACTER_BASE}/capybara-stun.webp`);
  // 숙이기: 뒤돌아 몸을 낮춘 앉은 뒷모습
  add("duck", `${CHARACTER_BASE}/capybara-idle-up.webp`);
  add("log", lobbyAssetSrc({ category: "props", id: "log-seat" }));
  add("meadow", MEADOW_SRC);
  add("mud", lobbyAssetSrc({ category: "ground", id: "mud" }));
  add("yuzu", `${CHARACTER_BASE}/wardrobe/hat/yuzu-towel.webp`);
  return sprites;
}

function ready(image: HTMLImageElement | undefined): image is HTMLImageElement {
  return !!image && image.complete && image.naturalWidth > 0;
}

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

/** 텍스처를 [left, left+width] 가로 구간에 세로로 이어 붙이고 offsetY만큼 아래로 민다 */
function drawTiled(ctx: CanvasRenderingContext2D, image: HTMLImageElement, left: number, width: number, offsetY: number) {
  if (!ready(image)) return;
  for (let y = (offsetY % TILE_SIZE) - TILE_SIZE * 2; y < GAME_HEIGHT + SHAKE_MAX_PX; y += TILE_SIZE) {
    for (let x = left; x < left + width; x += TILE_SIZE) {
      const w = Math.min(TILE_SIZE, left + width - x);
      ctx.drawImage(image, 0, 0, (image.naturalWidth * w) / TILE_SIZE, image.naturalHeight, x, y, w, TILE_SIZE);
    }
  }
}

/** (x, y) 중심의 ▲(up) 또는 ▼ 화살표 */
function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, up: boolean) {
  const tip = up ? -size : size;
  ctx.beginPath();
  ctx.moveTo(x, y + tip);
  ctx.lineTo(x - size, y - tip * 0.6);
  ctx.lineTo(x + size, y - tip * 0.6);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
}

function drawLog(ctx: CanvasRenderingContext2D, image: HTMLImageElement, log: Log, reducedMotion: boolean, palette: Palette) {
  if (!ready(image)) return;
  const raised = LOG_HEIGHTS[log.kind] === "high";
  const left = log.x - log.w / 2;
  const top = log.y - log.h / 2 - (raised ? BEAM_LIFT : 0);

  if (raised) {
    // 머리 높이 통나무: 판정 자리에 진한 그림자를 깔고, 통나무는 높이 띄워 파란 밧줄에 매단다
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = palette.shadow;
    ctx.fillRect(left, log.y - log.h / 4, log.w, log.h / 2);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = palette.duck;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const ropeX of [left + log.w * 0.2, left + log.w * 0.8]) {
      ctx.moveTo(ropeX, top - 90);
      ctx.lineTo(ropeX, top + log.h / 2);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (log.kind === "hurdle") {
    // 바닥 허들: 땅에 붙은 노란 띠
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = palette.jump;
    ctx.fillRect(left, log.y + log.h / 2 - 3, log.w, 8);
    ctx.globalAlpha = 1;
  }

  if (log.pace === "fast") {
    // 빠른 통나무: 뒤(위)로 붉은 속도선 + 붉은 빛
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = palette.fast;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = left + 10; x < left + log.w; x += 20) {
      ctx.moveTo(x, top - 4);
      ctx.lineTo(x, top - 22 - ((x - left) % 3) * 9);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowColor = palette.fast;
    ctx.shadowBlur = 16;
  }
  // 긴 통나무는 통나무 여러 개를 나란히 놓은 모양으로 그린다
  const segment = log.h * (LOG_SOURCE.width / LOG_SOURCE.height);
  const count = Math.max(1, Math.round(log.w / segment));
  const width = log.w / count;
  ctx.save();
  if (!reducedMotion && log.w < GAME_WIDTH) {
    // 굴러 내려오며 들썩이고, 옆으로 가는 통나무는 가는 쪽으로 기운다 (그림만 — 판정 박스는 그대로)
    const centerY = top + log.h / 2;
    ctx.translate(log.x, centerY);
    ctx.rotate(Math.max(-0.5, Math.min(0.5, log.vx / Math.max(1, log.vy))) * 0.5);
    ctx.scale(1, 1 + Math.sin(log.y / 10) * 0.1);
    ctx.translate(-log.x, -centerY);
  }
  for (let i = 0; i < count; i += 1) {
    ctx.drawImage(image, 0, 0, LOG_SOURCE.width, LOG_SOURCE.height, left + i * width, top, width, log.h);
  }
  ctx.restore();
  ctx.shadowBlur = 0;

  const middle = top + log.h / 2;
  if (log.kind === "hurdle" || log.kind === "beam") {
    ctx.fillStyle = log.kind === "hurdle" ? palette.jump : palette.duck;
    ctx.strokeStyle = palette.shadow;
    ctx.lineWidth = 3;
    for (let x = left + 45; x < left + log.w; x += 90) drawArrow(ctx, x, middle, 10, log.kind === "hurdle");
  }
  if (log.pace !== "normal") {
    ctx.font = `900 15px ${palette.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = palette.shadow;
    ctx.fillStyle = log.pace === "fast" ? palette.fast : palette.text;
    const label = log.pace === "fast" ? "빠름!" : "느릿";
    ctx.strokeText(label, log.x, middle);
    ctx.fillText(label, log.x, middle);
  }
}

function drawPickup(ctx: CanvasRenderingContext2D, state: GameState, image: HTMLImageElement, clockMs: number, reducedMotion: boolean, palette: Palette) {
  const pickup = state.pickup;
  if (!pickup || !ready(image)) return;
  const bob = reducedMotion ? 0 : Math.sin(clockMs / 140) * 4;
  const w = PICKUP_RADIUS * 2.6;
  const h = (w * image.naturalHeight) / image.naturalWidth;
  ctx.shadowColor = palette.jump;
  ctx.shadowBlur = 20;
  ctx.drawImage(image, pickup.x - w / 2, pickup.y - h / 2 + bob, w, h);
  ctx.shadowBlur = 0;
}

function drawCapybara(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  sprites: Sprites,
  clockMs: number,
  reducedMotion: boolean,
  palette: Palette,
  effects: Effects,
) {
  const jump = state.jumpMs > 0 ? Math.sin((1 - state.jumpMs / JUMP_MS) * Math.PI) : 0;
  const ducking = state.duckMs > 0 && !state.hitBy;
  const frame = reducedMotion ? "stand" : RUN_FRAMES[Math.floor(clockMs / RUN_FRAME_MS) % RUN_FRAMES.length];
  const image = state.hitBy ? sprites.stun : ducking ? sprites.duck : sprites[`${frame}-${RUN_FACINGS[state.lean + 1]}`];
  if (!ready(image)) return;

  if (jump > 0) {
    // 떠 있는 동안 발밑 그림자가 작아져 높이가 보인다
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = palette.shadow;
    ctx.beginPath();
    ctx.ellipse(state.x, CAPYBARA_Y + 22, 22 * (1 - jump * 0.35), 7 * (1 - jump * 0.35), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 보호막이 막은 뒤 무적인 동안 깜빡인다
  if (state.invincibleMs > 0 && Math.floor(clockMs / 80) % 2 === 0) ctx.globalAlpha = 0.35;
  const size = ducking ? CAPYBARA_SIZE * 0.78 : CAPYBARA_SIZE * (1 + jump * 0.12);
  // 발바닥을 기준으로 기울이고 찌그러뜨린다. 그림 발바닥이 판정 박스 아래쪽에 오게 둔다
  const squash = (effects.landMs / LAND_SQUASH_MS) * 0.22;
  ctx.save();
  ctx.translate(state.x, CAPYBARA_Y + 26 - jump * JUMP_HEIGHT);
  ctx.rotate(effects.tilt);
  ctx.scale(1 + squash, 1 - squash);
  ctx.drawImage(image, -size / 2, -size, size, size);
  ctx.globalAlpha = 1;

  const hat = sprites.yuzu;
  if (state.shield && !state.hitBy && ready(hat)) {
    const w = size * 0.5;
    const h = (w * hat.naturalHeight) / hat.naturalWidth;
    ctx.shadowColor = palette.jump;
    ctx.shadowBlur = 12;
    ctx.drawImage(hat, -w / 2, -size * 0.92 - h / 2, w, h);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

/** 빨라질수록 짙어지는 속도선 — 달리는 속도가 눈에 보이게 */
function drawSpeedLines(ctx: CanvasRenderingContext2D, state: GameState, palette: Palette) {
  const { fallSpeed } = getDifficulty(state.elapsedMs);
  const strength = Math.min(1, (fallSpeed - 300) / 500);
  if (strength <= 0) return;
  const travel = (state.elapsedMs / 1000) * fallSpeed * 1.4;
  ctx.globalAlpha = 0.25 * strength;
  ctx.strokeStyle = palette.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < SPEED_LINE_COUNT; i += 1) {
    const x = (i * 83 + 29) % GAME_WIDTH;
    const length = 40 + ((i * 37) % 60) * strength;
    const y = ((travel + i * 131) % (GAME_HEIGHT + length)) - length;
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + length);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawParticles(ctx: CanvasRenderingContext2D, effects: Effects) {
  for (const particle of effects.particles) {
    ctx.globalAlpha = 1 - particle.ageMs / particle.lifeMs;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  sprites: Sprites,
  clockMs: number,
  reducedMotion: boolean,
  palette: Palette,
  effects: Effects,
) {
  const scroll = reducedMotion ? 0 : (state.elapsedMs / 1000) * SCROLL_SPEED;
  const power = Math.min(SHAKE_MAX_PX, effects.shakePx * (effects.shakeMs / effects.shakeTotalMs));
  ctx.save();
  ctx.translate((Math.random() * 2 - 1) * power, (Math.random() * 2 - 1) * power);
  drawTiled(ctx, sprites.meadow, -SHAKE_MAX_PX, GAME_WIDTH + SHAKE_MAX_PX * 2, scroll);
  drawTiled(ctx, sprites.mud, 60, GAME_WIDTH - 120, scroll);
  if (!reducedMotion) drawSpeedLines(ctx, state, palette);

  // 바닥 통나무 → 유자 → 카피바라 → 머리 위를 지나는 통나무 → 파티클 순서로 그린다
  for (const log of state.logs) if (LOG_HEIGHTS[log.kind] !== "high") drawLog(ctx, sprites.log, log, reducedMotion, palette);
  drawPickup(ctx, state, sprites.yuzu, clockMs, reducedMotion, palette);
  drawCapybara(ctx, state, sprites, clockMs, reducedMotion, palette, effects);
  for (const log of state.logs) if (LOG_HEIGHTS[log.kind] === "high") drawLog(ctx, sprites.log, log, reducedMotion, palette);
  drawParticles(ctx, effects);
  ctx.restore();
}

function readHud(state: GameState, challengeMs: number | null): Hud {
  const recent = (at: number | null, ms: number) => at !== null && state.elapsedMs - at < ms;
  return {
    tenths: Math.floor(state.elapsedMs / 100),
    nearMisses: state.nearMisses,
    combo: state.combo,
    nearMissFlash: recent(state.lastNearMissAt, FLASH_MS),
    passedFlash: challengeMs !== null && state.elapsedMs >= challengeMs && state.elapsedMs - challengeMs < FLASH_MS * 2,
    cue: getCue(state),
    shield: state.shield,
    shieldFlash: recent(state.lastBlockAt, SHIELD_FLASH_MS)
      ? "block"
      : recent(state.lastShieldAt, SHIELD_FLASH_MS)
        ? state.lastShieldAt === state.lastNearMissAt
          ? "combo"
          : "get"
        : null,
  };
}

function subscribeNothing() {
  return () => {};
}

function formatCourseLabel(course: string | null) {
  if (!course) return "연습 코스";
  const [, month, day] = course.split("-");
  return `${Number(month)}월 ${Number(day)}일 코스`;
}

/** step 직전 상태 중 이번 프레임에 무슨 일이 있었는지 비교할 값 */
type FrameBefore = Pick<
  GameState,
  "hitBy" | "elapsedMs" | "jumpMs" | "duckMs" | "waveInMs" | "nextId" | "nearMisses" | "pickup" | "shield" | "lastBlockAt"
>;

interface Drag {
  pointerX: number;
  pointerY: number;
  startX: number;
  targetX: number;
  downAt: number;
  /** 누른 뒤 가장 멀리 움직인 거리(CSS px) */
  moved: number;
  /** 먼저 댄 손가락만 좌우 이동을 맡는다. 나머지 손가락은 탭·쓸기(점프·숙이기)만 한다 */
  mover: boolean;
  /** 이번 터치에서 쓴 위·아래 쓸기(한 번만). "down"이면 이 손가락을 뗄 때까지 숙인다 */
  swipe: "up" | "down" | null;
}

export function CapybaraLogDodge() {
  const records = useLogDodgeRecords();
  const challenge = useSyncExternalStore(subscribeNothing, () => parseChallenge(window.location.search), () => null);
  const courseDate = useSyncExternalStore(subscribeNothing, () => getCourseDate(Date.now()), () => null);
  const [mode, setMode] = useState<Mode>("daily");
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdownIndex, setCountdownIndex] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef({ left: false, right: false });
  /** 점프는 다음 프레임에 한 번 소비하고, 숙이기는 키·버튼·쓸기 중 하나라도 누르고 있으면 유지 */
  const actionRef = useRef({ jump: false, duckKey: false, duckButton: false });
  /** 화면에 닿아 있는 손가락마다(pointerId) 따로 본다 */
  const dragsRef = useRef(new Map<number, Drag>());
  const stateRef = useRef<GameState | null>(null);
  /** 게임 좌표 1px이 화면에서 몇 CSS px인지. 드래그 거리를 게임 좌표로 바꿀 때 쓴다 */
  const scaleRef = useRef(1);
  /** rAF 루프는 렌더링과 상관없이 돌아서 멈춤 여부를 ref로 읽는다 */
  const pausedRef = useRef(false);
  const { ref: recordsRef, inView: recordsVisible } = useInView<HTMLElement>(phase === "result");
  useLockPageScroll(phase === "countdown" || phase === "playing");

  function clearInput() {
    keysRef.current = { left: false, right: false };
    actionRef.current = { jump: false, duckKey: false, duckButton: false };
    dragsRef.current.clear();
  }

  // 멈출 때 입력을 비운다 — 방향키를 누른 채 멈추면 keyup을 놓쳐 이어할 때 한쪽으로 흘러간다
  function changePaused(next: boolean) {
    pausedRef.current = next;
    setPaused(next);
    if (next) clearInput();
  }

  const course = mode === "daily" ? courseDate : null;
  const courseBest = courseDate ? getCourseBest(records, courseDate) : null;

  useEffect(() => {
    if (phase !== "countdown") return;
    playGameSound(GAME_SOUNDS.countdown);
    const timers = COUNTDOWN_VALUES.map((_, index) =>
      setTimeout(() => {
        if (index < COUNTDOWN_VALUES.length - 1) {
          playGameSound(GAME_SOUNDS.countdown);
          setCountdownIndex(index + 1);
          return;
        }
        playGameSound(GAME_SOUNDS.go);
        setPhase("playing");
      }, COUNTDOWN_STEP_MS * (index + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const finishRound = useEffectEvent((state: GameState) => {
    changePaused(false);
    const now = Date.now();
    const record = { id: String(now), timeMs: state.elapsedMs, nearMisses: state.nearMisses, course, at: now };
    const rank = getRank(records, record);
    saveRecords(insertRecord(records, record));
    void submitGameRecord("capybara-log-dodge", record.timeMs, record);
    setResult({
      timeMs: record.timeMs,
      nearMisses: record.nearMisses,
      hitBy: state.hitBy ?? "roll",
      course,
      recordId: record.id,
      rank,
    });
    // 결과: 1위면 반짝, 친구 기록을 넘었거나 통나무 서퍼 이상이면 빠밤, 아니면 뿌우우
    const beat = challenge !== null && record.timeMs / 1000 > challenge;
    playGameSound(
      rank === 1 ? GAME_SOUNDS.record : beat || getLogDodgeTier(record.timeMs).minSeconds >= 25 ? GAME_SOUNDS.success : GAME_SOUNDS.fail,
    );
    setPhase("result");
  });

  const createRound = useEffectEvent(() =>
    createState(createRandom(course ? seedFromText(course) : Math.floor(Math.random() * 2 ** 32))),
  );

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const styles = getComputedStyle(canvas);
    const token = (name: string) => styles.getPropertyValue(name).trim();
    const palette: Palette = {
      shadow: token("--background"),
      text: token("--foreground"),
      jump: token("--warning"),
      duck: token("--primary"),
      fast: token("--destructive"),
      dust: token("--foreground"),
      wood: token("--capybara-dark"),
      font: styles.fontFamily,
    };
    const sprites = loadSprites();
    const effects = createEffects();
    const challengeMs = challenge === null ? null : challenge * 1000;

    function resize() {
      if (!canvas || !ctx) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      scaleRef.current = canvas.clientWidth / GAME_WIDTH;
      const pixelScale = ratio * scaleRef.current;
      ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    }

    stateRef.current = createRound();
    dragsRef.current.clear();
    resize();
    window.addEventListener("resize", resize);

    const startAt = performance.now();
    let lastAt = startAt;
    let lastHudKey = "";
    let lastCue: Hud["cue"] = null;
    let lastPassed = false;
    let lastStepAt = 0;
    let nextBeatAt = startAt;
    let beat = 0;
    let frameId = 0;
    let hitTimer: ReturnType<typeof setTimeout> | undefined;

    /** 달리기 비트: 매 박 쿵, 박 사이 칙, 2·4박 짝. 난이도가 오를수록 빨라진다 */
    function playBeat(state: GameState, now: number) {
      if (now < nextBeatAt) return;
      const rushBpm = Math.max(0, state.elapsedMs - PEAK_MS) / 1000;
      const bpm = BEAT_BPM.min + (BEAT_BPM.max - BEAT_BPM.min) * getDifficulty(state.elapsedMs).level + rushBpm;
      const beatMs = 60_000 / Math.min(BEAT_BPM.rush, bpm);
      const hat = { ...BEAT_HAT, at: beatMs / 2 };
      playGameSound(beat % 2 === 1 ? [BEAT_KICK, BEAT_SNARE, hat] : [BEAT_KICK, hat]);
      beat += 1;
      // 멈췄다 이어하면 밀린 박을 몰아 치지 않는다
      nextBeatAt = Math.max(nextBeatAt + beatMs, now);
    }

    /** step 앞뒤 상태를 비교해 이번 프레임에 일어난 일마다 소리를 한 번씩 낸다 */
    function playFrameSounds(
      state: GameState,
      before: FrameBefore,
      now: number,
    ) {
      if (state.hitBy) {
        // 맞은 뒤에도 흔들림·파편이 보이게 프레임은 계속 돈다 — 소리는 맞은 프레임에 한 번만
        if (!before.hitBy) {
          playGameSound(GAME_SOUNDS.hit);
          playGameSound(SOUNDS.caught);
        }
        return;
      }
      if (state.jumpMs > before.jumpMs) playGameSound(JUMP_SOUND);
      else if (before.jumpMs > 0 && state.jumpMs === 0) playGameSound(LAND_SOUND);
      if (before.duckMs === 0 && state.duckMs > 0) playGameSound(DUCK_SOUND);
      // 발소리: 땅에서 좌우로 움직일 때만, 간격을 두고
      if (state.lean !== 0 && state.jumpMs === 0 && now - lastStepAt >= STEP_SOUND_MS) {
        lastStepAt = now;
        playGameSound(SOUNDS.step);
      }

      let split = false;
      let bounced = false;
      for (const log of state.logs) {
        // 쪼개진 조각은 원래 통나무(LOG_THICKNESS + 8)보다 얇다
        if (log.id >= before.nextId && log.kind === "split" && log.h === LOG_THICKNESS) split = true;
        // 튕긴 프레임에만 벽에 딱 붙어 있다 (step이 가장자리로 되돌림)
        if (log.kind === "bounce" && (log.x === log.w / 2 || log.x === GAME_WIDTH - log.w / 2)) bounced = true;
      }
      if (state.waveInMs > before.waveInMs) {
        const wave = state.logs.find((log) => log.id >= before.nextId);
        if (wave) {
          playGameSound(WAVE_SOUNDS[wave.kind]);
          if (wave.pace !== "normal") playGameSound(PACE_SOUNDS[wave.pace]);
        }
      }
      if (split) playGameSound(SPLIT_SOUND);
      else if (bounced) playGameSound(BOUNCE_SOUND);
      if (state.nearMisses > before.nearMisses) {
        playGameSound(GAME_SOUNDS.whoosh);
        if (state.combo >= 2) playGameSound(COMBO_SOUNDS[Math.min(state.combo, COMBO_SOUNDS.length) - 1]);
      }
      if (state.pickup && !before.pickup) playGameSound(PICKUP_SPAWN_SOUND);
      if (state.shield && !before.shield) playGameSound(SHIELD_GET_SOUND);
      if (state.lastBlockAt !== before.lastBlockAt) playGameSound(SHIELD_BREAK_SOUND);

      // 등급 시간을 넘기면 빠라밤, 새 통나무 종류가 풀리면 따단 (겹치면 등급 소리만)
      const crossed = (ms: number) => before.elapsedMs < ms && state.elapsedMs >= ms;
      if (getLogDodgeTier(before.elapsedMs) !== getLogDodgeTier(state.elapsedMs)) playGameSound(TIER_UP_SOUND);
      else if (Object.values(LOG_UNLOCK_MS).some((ms) => ms > 0 && crossed(ms))) playGameSound(LEVEL_UP_SOUND);
    }

    /** 흔들림·파티클·착지 찌그러짐. 움직임 줄이기 설정이면 아무것도 만들지 않는다 */
    function playFrameEffects(state: GameState, before: FrameBefore) {
      if (reducedMotion) return;
      const feetY = CAPYBARA_Y + 22;
      if (state.hitBy) {
        if (before.hitBy) return;
        shake(effects, SHAKE_MAX_PX, 360);
        burst(effects, state.x, CAPYBARA_Y, palette.wood, 18, 340);
        burst(effects, state.x, CAPYBARA_Y, palette.dust, 12, 280);
        return;
      }
      if (state.jumpMs > before.jumpMs) burst(effects, state.x, feetY, palette.dust, 5, 120, true);
      else if (before.jumpMs > 0 && state.jumpMs === 0) {
        effects.landMs = LAND_SQUASH_MS;
        burst(effects, state.x, feetY, palette.dust, 8, 170, true);
      }
      for (const log of state.logs) {
        if (log.id >= before.nextId && log.kind === "split" && log.h === LOG_THICKNESS) {
          burst(effects, log.x, log.y, palette.wood, 7, 260);
          shake(effects, 4, 180);
        }
        if (log.vx !== 0 && (log.x === log.w / 2 || log.x === GAME_WIDTH - log.w / 2)) {
          burst(effects, log.x === log.w / 2 ? 0 : GAME_WIDTH, log.y, palette.wood, 5, 200);
        }
      }
      if (state.nearMisses > before.nearMisses) burst(effects, state.x, CAPYBARA_Y, palette.jump, 8 + 3 * state.combo, 260);
      if (state.shield && !before.shield) burst(effects, state.x, CAPYBARA_Y - 30, palette.jump, 16, 240);
      if (state.lastBlockAt !== before.lastBlockAt) {
        shake(effects, 7, 260);
        burst(effects, state.x, CAPYBARA_Y - 20, palette.jump, 14, 340);
        burst(effects, state.x, CAPYBARA_Y - 20, palette.wood, 10, 300);
      }
    }

    function tick(now: number) {
      const state = stateRef.current;
      if (!state || !ctx) return;
      if (pausedRef.current) {
        // step은 건너뛰고 기준 시각만 옮긴다 → 이어할 때 시간이 튀지 않음. 멈춘 동안 resize로 캔버스가 지워져도 다시 그림
        lastAt = now;
        effects.shakeMs = 0;
        draw(ctx, state, sprites, Math.max(0, now - startAt), reducedMotion, palette, effects);
        frameId = requestAnimationFrame(tick);
        return;
      }
      const { left, right } = keysRef.current;
      const action = actionRef.current;
      const frameMs = Math.min(50, now - lastAt);
      const before: FrameBefore = {
        hitBy: state.hitBy,
        elapsedMs: state.elapsedMs,
        jumpMs: state.jumpMs,
        duckMs: state.duckMs,
        waveInMs: state.waveInMs,
        nextId: state.nextId,
        nearMisses: state.nearMisses,
        pickup: state.pickup,
        shield: state.shield,
        lastBlockAt: state.lastBlockAt,
      };
      let targetX: number | null = null;
      let duckSwipe = false;
      for (const drag of dragsRef.current.values()) {
        if (drag.mover) targetX = drag.targetX;
        if (drag.swipe === "down") duckSwipe = true;
      }
      // rAF는 백그라운드 탭에서 멈추고, step이 프레임 간격에 상한을 둬서 자연히 일시정지된다
      step(state, now - lastAt, {
        direction: left === right ? 0 : left ? -1 : 1,
        targetX,
        jump: action.jump,
        duck: action.duckKey || action.duckButton || duckSwipe,
      });
      action.jump = false;
      lastAt = now;
      // 움직임 줄이기 설정이면 아슬아슬 슬로모션을 쓰지 않는다
      if (reducedMotion) state.slowmoMs = 0;
      playFrameEffects(state, before);
      stepEffects(effects, frameMs, reducedMotion || state.hitBy ? 0 : state.lean);
      draw(ctx, state, sprites, Math.max(0, now - startAt), reducedMotion, palette, effects);
      playFrameSounds(state, before, now);
      if (!state.hitBy) playBeat(state, now);

      const nextHud = readHud(state, challengeMs);
      // "점프!"는 올라가는 삐삐↑, "숙여!"는 내려가는 삐삐↓ — 소리만 들어도 위아래 구분. 친구 기록을 넘은 순간 띵동
      if (nextHud.cue && nextHud.cue !== lastCue && !state.hitBy) playGameSound(nextHud.cue === "jump" ? JUMP_CUE_SOUND : DUCK_CUE_SOUND);
      if (nextHud.passedFlash && !lastPassed) playGameSound(GAME_SOUNDS.correct);
      lastCue = nextHud.cue;
      lastPassed = nextHud.passedFlash;
      const hudKey = Object.values(nextHud).join("|");
      if (hudKey !== lastHudKey) {
        lastHudKey = hudKey;
        setHud(nextHud);
      }

      if (state.hitBy) hitTimer ??= setTimeout(() => finishRound(state), HIT_PAUSE_MS);
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(hitTimer);
      window.removeEventListener("resize", resize);
    };
  }, [phase, challenge]);

  function startCountdown() {
    changePaused(false);
    clearInput();
    setHud(null);
    setCountdownIndex(0);
    setPhase("countdown");
  }

  // 좌우 드래그는 손가락이 움직인 거리만큼 카피바라를 옮기고(손가락이 카피바라를 가리지 않게),
  // 위로 쓸거나 탭하면 점프, 아래로 쓸면 손을 뗄 때까지 숙인다.
  // 손가락마다 따로 봐서, 한 손가락으로 옮기는 동안 다른 손가락으로 탭·쓸어 점프·숙이기를 할 수 있다
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const state = stateRef.current;
    if (phase !== "playing" || !state || pausedRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const drags = dragsRef.current;
    drags.set(event.pointerId, {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: state.x,
      targetX: state.x,
      downAt: performance.now(),
      moved: 0,
      mover: ![...drags.values()].some((drag) => drag.mover),
      swipe: null,
    });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragsRef.current.get(event.pointerId);
    if (phase !== "playing" || !drag) return;
    const dx = event.clientX - drag.pointerX;
    const dy = event.clientY - drag.pointerY;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    if (drag.mover) drag.targetX = drag.startX + dx / scaleRef.current;
    if (drag.swipe || Math.abs(dy) < SWIPE_PX || Math.abs(dy) < Math.abs(dx)) return;
    drag.swipe = dy < 0 ? "up" : "down";
    if (dy < 0) actionRef.current.jump = true;
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragsRef.current.get(event.pointerId);
    if (phase === "playing" && drag && !drag.swipe && drag.moved < TAP_PX && performance.now() - drag.downAt < TAP_MS) {
      actionRef.current.jump = true;
    }
    dragsRef.current.delete(event.pointerId);
  }

  // 시작/재시작은 click으로 받아 스크롤하려고 끄는 동작에는 반응하지 않게 한다
  function handleClick() {
    if (phase !== "idle" && phase !== "result") return;
    playGameSound(GAME_SOUNDS.start);
    startCountdown();
  }

  function releaseDuckButton() {
    actionRef.current.duckButton = false;
  }

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    const pressed = event.type === "keydown";
    if (phase === "playing") {
      // 멈춘 동안 이동·점프·숙이기 키는 무시한다 (멈출 때 입력은 이미 비웠다)
      if (pausedRef.current) return;
      if (LEFT_KEYS.has(event.key) || RIGHT_KEYS.has(event.key)) {
        event.preventDefault();
        if (LEFT_KEYS.has(event.key)) keysRef.current.left = pressed;
        else keysRef.current.right = pressed;
        return;
      }
      if (DUCK_KEYS.has(event.key)) {
        event.preventDefault();
        actionRef.current.duckKey = pressed;
        return;
      }
      if (JUMP_KEYS.has(event.key)) {
        event.preventDefault();
        if (pressed && !event.repeat) actionRef.current.jump = true;
        return;
      }
    }

    if (!pressed || event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    if (event.target instanceof HTMLElement && event.target.closest("a, button, input, textarea, select")) return;
    event.preventDefault();
    handleClick();
  });

  // 키를 누른 채 다른 창으로 가면(Alt+Tab 등) 창은 보여서 멈추지 않는데 keyup을 놓친다 — 돌아와도 한쪽으로 계속 달리거나 숙인 채로 남지 않게 비운다
  const handleBlur = useEffectEvent(() => clearInput());

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const tier = result ? getLogDodgeTier(result.timeMs) : null;
  const resultSeconds = result ? formatSeconds(result.timeMs) : "";
  const beatChallenge = result !== null && challenge !== null && result.timeMs / 1000 > challenge;

  const screenClass =
    phase === "countdown"
      ? "bg-success text-neutral-950"
      : phase === "result" && tier && !recordsVisible
        ? cn(tier.bgClass, tier.fgClass)
        : "bg-background text-foreground";

  let shareText = "굴러오는 통나무를 좌우로 피하고, 점프로 넘고, 숙여서 지나가는 카피바라. 오늘의 코스 몇 초 버틸 수 있어요?";
  if (phase === "result" && result && tier) {
    if (challenge === null) {
      shareText = `${TITLE} ${formatCourseLabel(result.course)}에서 ${resultSeconds}초 버텨서 '${tier.label}' 등급! 내 기록 깰 수 있어?`;
    } else if (beatChallenge) {
      shareText = `친구 기록 ${challenge}초 넘었다 😎 ${resultSeconds}초 버팀. 너도 해봐`;
    } else {
      shareText = `${challenge}초 못 넘고 ${resultSeconds}초에서 납작… 복수 도와줘`;
    }
  }
  // 받은 사람 화면에 "친구 기록 N초"가 뜨게 기록을 주소에 싣는다. 결과 화면은 클릭 뒤에만 나오므로 window를 써도 된다
  const shareUrl =
    phase === "result" && result
      ? `${window.location.origin}${window.location.pathname}?vs=${resultSeconds}`
      : undefined;

  const liveMessage =
    phase === "countdown"
      ? `${COUNTDOWN_VALUES[countdownIndex]}`
      : phase === "playing" && hud?.cue
        ? hud.cue === "jump"
          ? "점프"
          : "숙이기"
        : phase === "result" && result && tier
          ? `${result.rank}위, ${resultSeconds}초, ${tier.label} 등급`
          : "";

  const actionButtonClass =
    "flex min-h-14 min-w-24 cursor-pointer touch-none select-none items-center justify-center gap-1.5 rounded-full bg-black/45 px-5 text-title-3 font-bold text-white transition-colors active:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <div
      data-testid="capybara-log-dodge-screen"
      data-phase={phase}
      data-paused={paused}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      className={cn(
        "relative flex min-h-dvh w-full cursor-pointer select-none flex-col items-center justify-center overflow-hidden px-5 py-10 transition-colors [-webkit-tap-highlight-color:transparent]",
        phase === "playing" ? "h-dvh touch-none" : "touch-manipulation",
        phase === "result" ? "duration-700" : "duration-200",
        screenClass,
      )}
    >
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {phase === "idle" && (
        <ShareButton className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]" title={TITLE} text={shareText} />
      )}

      {phase === "idle" && (
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <header className="flex flex-col items-center gap-2">
            <Image
              src={`${CHARACTER_BASE}/capybara-walk1-up.webp`}
              alt="통나무 사이로 달려가는 카피바라 뒷모습"
              width={120}
              height={120}
              unoptimized
              priority
            />
            <h1 className="px-12 text-title-1 font-bold text-text-strong">{TITLE}</h1>
            <p className="text-caption-1 text-balance text-text-caption">
              비탈 위에서 통나무가 굴러 내려와요. 좌우로 드래그해 피하고, 노란 ▲ 바닥 통나무는 탭하거나 위로 쓸어 점프, 파란 밧줄에 매달린 ▼ 통나무는 아래로 쓸어 숙이세요. 한 손가락으로 옮기면서 다른 손가락으로 점프·숙이기를 해도 돼요. 빨갛게 빛나는 통나무는 빠르고, 휘어 오는 통나무는 끝까지 따라와요. 유자 수건을 먹거나 아슬아슬하게 {COMBO_SHIELD_AT}번 연달아 스치면 한 번 막아 줘요. 키보드는 방향키(←→ 이동, ↑·Space 점프, ↓ 숙이기)예요.
            </p>
          </header>

          {challenge !== null && (
            <p data-testid="challenge-banner" className="rounded-full bg-primary/15 px-5 py-2 text-title-3 font-bold text-primary">
              친구 기록 {challenge}초 — 이겨볼래?
            </p>
          )}

          <div className="flex flex-col items-center gap-2" onPointerDown={stopPropagation} onClick={stopPropagation}>
            <div role="group" aria-label="코스 선택" className="flex gap-1 rounded-full bg-card p-1">
              {(["daily", "practice"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => {
                    playGameSound(GAME_SOUNDS.tap);
                    setMode(value);
                  }}
                  className={cn(
                    "min-h-11 cursor-pointer rounded-full px-5 text-caption-1 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    mode === value ? "bg-primary text-white" : "text-text-caption hover:text-text-strong",
                  )}
                >
                  {value === "daily" ? "오늘의 코스" : "연습(랜덤)"}
                </button>
              ))}
            </div>
            <p className="text-caption-2 text-text-caption tabular-nums">
              {mode === "daily"
                ? `오늘은 모두 같은 통나무 순서예요${courseBest !== null ? ` · 내 오늘 최고 ${formatSeconds(courseBest)}초` : ""}`
                : "매번 다른 통나무 순서예요"}
            </p>
          </div>

          <p className="text-title-1 font-bold text-text-strong">클릭해서 시작하세요</p>

          <LogDodgeLeaderboard records={records} />
        </div>
      )}

      {phase !== "idle" && <h1 className="sr-only">{TITLE}</h1>}

      {phase === "countdown" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            key={countdownIndex}
            data-testid="countdown"
            className="animate-in fade-in zoom-in-50 animation-duration-300 text-[11rem] font-black leading-none tabular-nums sm:text-[15rem]"
          >
            {COUNTDOWN_VALUES[countdownIndex]}
          </span>
          <p className="text-title-3 font-semibold text-balance opacity-80">좌우로 피하고 · 노란 ▲는 점프 · 파란 ▼는 숙이기</p>
        </div>
      )}

      {phase === "playing" && (
        // 넓은 화면의 바깥 여백: 풀밭 텍스처를 흐리게 깔아 몰입감은 유지한다
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 scale-110 bg-repeat opacity-40 blur-2xl"
          style={{ backgroundImage: `url(${MEADOW_SRC})` }}
        />
      )}

      {phase === "playing" && (
        // 플레이 영역은 고정 비율 그대로 화면에 들어가는 최대 크기 (비행기 슈팅과 같은 방식 — 기기마다 보이는 범위가 같게)
        <div
          data-testid="play-area"
          className="dark absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden text-foreground shadow-2xl"
          style={{
            width: `min(100vw, calc(100dvh * ${GAME_WIDTH} / ${GAME_HEIGHT}))`,
            height: `min(100dvh, calc(100vw * ${GAME_HEIGHT} / ${GAME_WIDTH}))`,
          }}
        >
          <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full" />
          {hud && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-16 pt-[max(1rem,env(safe-area-inset-top))]">
              <p className="rounded-full bg-black/40 px-4 py-1 text-title-1 font-black tabular-nums">
                {(hud.tenths / 10).toFixed(1)}초
              </p>
              <p className="flex gap-2 text-caption-1 font-semibold tabular-nums">
                {challenge !== null && <span className="rounded-full bg-black/40 px-3 py-0.5">친구 {challenge}초</span>}
                {hud.nearMisses > 0 && <span className="rounded-full bg-black/40 px-3 py-0.5">아슬아슬 {hud.nearMisses}</span>}
                {hud.shield && <span className="rounded-full bg-warning px-3 py-0.5 text-neutral-950">유자 보호막</span>}
              </p>
              {hud.nearMissFlash && (
                <p
                  key={hud.combo}
                  className={cn(
                    "mt-24 animate-in zoom-in-50 font-black text-warning drop-shadow-lg",
                    hud.combo >= COMBO_SHIELD_AT ? "text-[2.75rem] leading-none" : "text-title-1",
                  )}
                >
                  {hud.combo >= 2 ? `아슬아슬 ×${hud.combo}!` : "아슬아슬!"}
                </p>
              )}
              {hud.shieldFlash && (
                <p className={cn("animate-in zoom-in-75 text-title-2 font-black", hud.shieldFlash === "block" ? "text-primary" : "text-warning")}>
                  {hud.shieldFlash === "block" ? "보호막이 막았어요!" : hud.shieldFlash === "combo" ? "콤보 보상! 유자 보호막" : "유자 보호막!"}
                </p>
              )}
              {hud.passedFlash && (
                <p className="mt-4 animate-in zoom-in-75 text-title-1 font-black text-success">친구 추월!</p>
              )}
            </div>
          )}
          {hud?.cue && (
            // 점프는 노랑·위쪽·↑, 숙이기는 파랑·아래쪽·↓ — 캔버스 화살표·버튼과 같은 색
            <p
              key={hud.cue}
              data-testid="action-cue"
              className={cn(
                "pointer-events-none absolute inset-x-0 flex animate-in zoom-in-75 items-center justify-center gap-1 text-[2.5rem] font-black drop-shadow-lg",
                hud.cue === "jump" ? "bottom-[38%] text-warning" : "bottom-[27%] text-primary",
              )}
            >
              {hud.cue === "jump" ? (
                <ArrowUp aria-hidden="true" strokeWidth={3.5} className="size-10" />
              ) : (
                <ArrowDown aria-hidden="true" strokeWidth={3.5} className="size-10" />
              )}
              {hud.cue === "jump" ? "점프!" : "숙여!"}
            </p>
          )}
          <div className="absolute inset-x-0 bottom-0 flex justify-between gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              className={cn(actionButtonClass, "ring-2 ring-primary/70", hud?.cue === "duck" && "bg-primary active:bg-primary")}
              onPointerDown={(event) => {
                event.stopPropagation();
                actionRef.current.duckButton = true;
              }}
              onPointerUp={releaseDuckButton}
              onPointerLeave={releaseDuckButton}
              onPointerCancel={releaseDuckButton}
              onClick={stopPropagation}
            >
              <ArrowDown aria-hidden="true" className="size-5" />
              숙이기
            </button>
            <button
              type="button"
              className={cn(
                actionButtonClass,
                "ring-2 ring-warning/70",
                hud?.cue === "jump" && "bg-warning text-neutral-950 active:bg-warning",
              )}
              onPointerDown={(event) => {
                event.stopPropagation();
                actionRef.current.jump = true;
              }}
              onClick={(event) => {
                event.stopPropagation();
                // 키보드로 버튼을 누른 경우(포인터 없이 click만 온다)
                if (event.detail === 0) actionRef.current.jump = true;
              }}
            >
              점프
              <ArrowUp aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
      )}

      {phase === "result" && result && tier && (
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <section
            data-testid="result-hero"
            className="flex min-h-[calc(100dvh-5rem)] w-full flex-col items-center justify-center gap-6"
          >
            <div className="flex flex-col items-center gap-3">
              <Image src={tier.image} alt={`${tier.label} 등급 카피바라`} width={120} height={120} unoptimized />
              <p data-testid="result-tier" className="rounded-full bg-black/15 px-4 py-1 text-caption-1 font-bold">
                {tier.label}
              </p>
              <p className="flex items-baseline gap-2 font-black tabular-nums">
                <span data-testid="result-time" className="text-[5rem] leading-none sm:text-[7rem]">
                  {resultSeconds}
                </span>
                <span className="text-title-1">초</span>
              </p>
              <p data-testid="result-rank" className="text-title-2 font-bold tabular-nums">
                {result.rank}위
              </p>
            </div>

            <div className="flex flex-col items-center gap-1">
              <p data-testid="result-summary" className="text-title-3 font-semibold text-balance">
                {tier.label} {resultSeconds}초, {tier.description}
              </p>
              <p className="text-caption-1 text-balance opacity-80">
                {getDeathLine(result.hitBy, result.timeMs)} · {formatCourseLabel(result.course)} · 아슬아슬 {result.nearMisses}번
              </p>
              {challenge !== null && (
                <p data-testid="challenge-result" className="text-title-3 font-bold">
                  {beatChallenge ? `친구 기록 ${challenge}초를 넘었어요!` : `친구 기록 ${challenge}초까지 조금 더!`}
                </p>
              )}
            </div>

            <div
              className="flex cursor-default items-center gap-3 rounded-full bg-black/10 py-1.5 pr-1.5 pl-5"
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
            >
              <p className="text-caption-1 font-semibold">이 기록을 친구에게 공유할까요?</p>
              <ShareButton title={TITLE} text={shareText} url={shareUrl} />
            </div>

            <GameOverActions onRetry={startCountdown} className="max-w-xs" />

            <p className="flex items-center gap-1 text-caption-2 font-medium opacity-80">
              <ChevronDown aria-hidden="true" className="size-4" />
              아래로 내리면 순위 기록이 나와요
            </p>
          </section>

          <section
            ref={recordsRef}
            data-testid="result-records"
            data-visible={recordsVisible}
            onPointerDown={stopPropagation}
            onClick={stopPropagation}
            className={cn(
              "flex w-full cursor-default flex-col gap-6 pb-6 transition-[opacity,translate] duration-700",
              recordsVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0",
            )}
          >
            <LogDodgeLeaderboard records={records} highlightId={result.recordId} />
          </section>
        </div>
      )}

      <GameControls
        className={phase === "playing" ? "dark text-foreground" : undefined}
        pause={
          phase === "playing"
            ? {
                paused,
                onPause: () => changePaused(true),
                onResume: () => changePaused(false),
                onRestart: startCountdown,
              }
            : undefined
        }
      />
    </div>
  );
}

export default CapybaraLogDodge;
