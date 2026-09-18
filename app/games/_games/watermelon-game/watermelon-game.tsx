"use client";

import { ChevronDown } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { GameControls } from "@/components/games/game-controls";
import { GameOverActions } from "@/components/games/game-over-actions";
import { ShareButton } from "@/components/games/share-button";
import { cn } from "@/lib";
import { GAME_SOUNDS, GAME_TITLES } from "@/lib/games/constants";
import { submitGameRecord } from "@/lib/games/game-events";
import { useInView } from "@/lib/games/use-in-view";
import { useLockPageScroll } from "@/lib/games/use-lock-page-scroll";
import { playGameSound, type SoundLayer } from "@/lib/lobby/settings";

import {
  AIM_KEY_SPEED,
  APPEAR_MS,
  DEADLINE_Y,
  DROP_COOLDOWN_MS,
  DROP_SOUND,
  DROP_Y,
  FRUIT_FACES,
  FRUIT_IMAGE_BASE,
  FRUIT_IMAGE_SCALE,
  type FruitFace,
  FRUITS,
  GAME_HEIGHT,
  GAME_WIDTH,
  IMPACT_SPEED,
  MERGE_COMBO_MS,
  MERGE_GATHER_MS,
  MERGE_PITCH_STEP,
  MERGE_POP_MS,
  MERGE_SOUND,
  SQUASH_MS,
  SURPRISE_SPEED,
  WARNING_SOUND_MS,
  WATERMELON_LEVEL,
} from "./constants";
import { WatermelonLeaderboard } from "./leaderboard";
import { canDrop, clampAim, createState, drop, type GameEvent, type GameState, isWarning, type Point, step } from "./logic";
import { getRank, insertRecord, saveRecords, useWatermelonRecords } from "./records";
import { getWatermelonTier } from "./tiers";

export const COUNTDOWN_VALUES = [3, 2, 1] as const;
export const COUNTDOWN_STEP_MS = 800;
/** 끝난 순간 상자를 붉게 보여주는 시간 */
const OVER_PAUSE_MS = 900;
/** 이 단계(파인애플) 이상이 생기거나 수박이 사라지면 화면이 흔들린다 */
const SHAKE_LEVEL = 8;
const TITLE = GAME_TITLES["watermelon-game"];
const LEFT_KEYS = new Set(["ArrowLeft", "a", "A"]);
const RIGHT_KEYS = new Set(["ArrowRight", "d", "D"]);
const DROP_KEYS = new Set([" ", "Enter", "ArrowDown", "s", "S"]);

type Phase = "idle" | "countdown" | "playing" | "result";

interface RoundResult {
  score: number;
  maxLevel: number;
  recordId: string;
  rank: number;
}

interface Hud {
  score: number;
  next: number;
  warning: boolean;
}

interface Particle {
  /** 즙 방울(동그라미) / 눈물(파란 물방울 모양) / 별(천천히 떠오르며 돈다) / 먼지(착지할 때 옆으로 퍼짐) */
  shape: "dot" | "tear" | "star" | "dust";
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  lifeMs: number;
  ageMs: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  ageMs: number;
  /** 콤보 글씨처럼 크게·색 있게 튀어나오는 것 */
  big?: boolean;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  ageMs: number;
}

/** 합쳐지는 두 과일(level). 우는 얼굴로 from 두 자리에서 (x, y)로 모여들며 찌그러졌다가 펑 터진다 */
interface Merging {
  level: number;
  from: readonly Point[];
  x: number;
  y: number;
  ageMs: number;
  /** 터지는 순간 즙·눈물·별을 한 번만 뿌리려고 */
  burst: boolean;
  /** 합쳐져 생긴 과일 단계 (수박 둘이면 사라짐 = null) */
  bornLevel: number | null;
}

interface Effects {
  particles: Particle[];
  popups: Popup[];
  rings: Ring[];
  merging: Merging[];
  /** 합쳐져 새로 생긴 과일 id → 모여드는 연출이 끝날 때까지 남은 시간(그동안 안 그린다) */
  hidden: Map<number, number>;
  /** 과일 id → 나타난 뒤 지난 시간 (통통 튀어나오기) */
  appear: Map<number, number>;
  /** 과일 id → 착지해서 찌그러진 뒤 지난 시간 */
  squash: Map<number, number>;
  /** 과일 id → 지난 프레임 세로 속도 (착지 판별용) */
  lastVy: Map<number, number>;
  combo: { count: number; atMs: number };
  shakeMs: number;
  shakePower: number;
}

function createEffects(): Effects {
  return {
    particles: [],
    popups: [],
    rings: [],
    merging: [],
    hidden: new Map(),
    appear: new Map(),
    squash: new Map(),
    lastVy: new Map(),
    combo: { count: 0, atMs: -Infinity },
    shakeMs: 0,
    shakePower: 0,
  };
}

interface Palette {
  board: string;
  line: string;
  danger: string;
  text: string;
}

const POPUP_MS = 800;
const RING_MS = 350;

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

/** 합체음은 큰 과일일수록 낮게 */
function mergeSound(level: number): SoundLayer[] {
  const ratio = MERGE_PITCH_STEP ** level;
  return MERGE_SOUND.map((layer) => ({ ...layer, from: layer.from * ratio, to: layer.to * ratio }));
}

/** 펠트 과일 그림 (과일 단계 × 표정) */
const fruitImages = new Map<string, HTMLImageElement>();
function fruitImage(level: number, face: FruitFace) {
  const slug = `${FRUITS[level].slug}${face}`;
  let image = fruitImages.get(slug);
  if (!image) {
    image = new Image();
    image.decoding = "async";
    image.src = `${FRUIT_IMAGE_BASE}/${slug}.webp`;
    fruitImages.set(slug, image);
  }
  return image;
}
const loaded = (image: HTMLImageElement) => image.complete && image.naturalWidth > 0;

/**
 * 과일 그림을 전부 미리 불러온다. 처음 나오는 과일(합쳐져 처음 생긴 단계)을 그때 불러오면
 * 받는 몇 프레임 동안 캔버스 원으로 그렸다가 펠트 그림으로 바뀌어 번쩍였다
 */
function preloadFruitImages() {
  FRUITS.forEach((_, level) => FRUIT_FACES.forEach((face) => fruitImage(level, face)));
}

/** 과일 그림: 펠트 그림 한 장(표정 그림이 아직 없으면 평소 얼굴). 그림을 아직 못 받았으면 원·줄무늬·광택·얼굴로 대신 그린다 */
function drawFruit(ctx: CanvasRenderingContext2D, level: number, x: number, y: number, r: number, blink: boolean, face: FruitFace = "") {
  const fruit = FRUITS[level];
  const image = [fruitImage(level, face), fruitImage(level, "")].find(loaded);
  if (image) {
    const side = r * 2 * FRUIT_IMAGE_SCALE;
    ctx.drawImage(image, x - side / 2, y - side / 2, side, side);
    return;
  }
  const tau = Math.PI * 2;
  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, tau);
  ctx.fillStyle = fruit.color;
  ctx.fill();

  if (fruit.stripe) {
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = fruit.stripe;
    ctx.lineWidth = r * 0.13;
    ctx.lineJoin = "round";
    for (let k = -2; k <= 2; k += 1) {
      ctx.beginPath();
      for (let i = 0; i <= 8; i += 1) {
        const px = k * r * 0.45 + (i % 2 === 0 ? -1 : 1) * r * 0.07;
        const py = -r + (i * r) / 4;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // 입체감: 왼쪽 위는 밝게, 가장자리는 어둡게
  const shade = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r);
  shade.addColorStop(0, "rgba(255,255,255,0.28)");
  shade.addColorStop(0.55, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, tau);
  ctx.fillStyle = shade;
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.48, r * 0.2, r * 0.1, -0.6, 0, tau);
  ctx.fill();

  // 꼭지
  ctx.strokeStyle = "rgba(60,40,20,0.9)";
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.92);
  ctx.quadraticCurveTo(r * 0.05, -r * 1.12, r * 0.14, -r * 1.2);
  ctx.stroke();

  // 얼굴
  ctx.fillStyle = "rgba(25,20,20,0.85)";
  ctx.strokeStyle = "rgba(25,20,20,0.85)";
  const eyeX = r * 0.3;
  const eyeY = r * 0.02;
  const eyeR = Math.max(1.4, r * 0.075);
  if (blink) {
    ctx.lineWidth = Math.max(1, r * 0.04);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * eyeX - eyeR, eyeY);
      ctx.lineTo(side * eyeX + eyeR, eyeY);
      ctx.stroke();
    }
  } else {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * eyeX, eyeY, eyeR, 0, tau);
      ctx.fill();
    }
  }
  ctx.lineWidth = Math.max(1.1, r * 0.05);
  ctx.beginPath();
  ctx.arc(0, r * 0.14, r * 0.15, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();

  ctx.restore();
}

const COMBO_COLORS = ["#fde047", "#fb923c", "#f472b6", "#a78bfa", "#38bdf8"];

function addMergeEffects(effects: Effects, event: GameEvent, reducedMotion: boolean, nowMs: number) {
  if (event.kind === "drop") return;
  const level = event.kind === "merge" ? event.level : WATERMELON_LEVEL;
  const radius = FRUITS[level].radius;
  effects.popups.push({ x: event.x, y: event.y - radius * 0.3, text: `+${event.points}`, ageMs: 0 });
  // 짧은 시간 안에 연달아 합치면 콤보 글씨가 커지며 튀어나온다
  effects.combo = { count: nowMs - effects.combo.atMs <= MERGE_COMBO_MS ? effects.combo.count + 1 : 1, atMs: nowMs };
  if (effects.combo.count >= 2) {
    effects.popups.push({ x: event.x, y: event.y - radius - 26, text: `${effects.combo.count}콤보!`, ageMs: 0, big: true });
  }
  if (reducedMotion) return;
  // 두 과일이 우는 얼굴로 모여들었다가 펑 — 새 과일은 모여드는 동안 숨겨 뒀다가 터질 때 튀어나오게 한다
  effects.merging.push({
    level: event.kind === "merge" ? event.level - 1 : WATERMELON_LEVEL,
    from: event.from,
    x: event.x,
    y: event.y,
    ageMs: 0,
    burst: false,
    bornLevel: event.kind === "merge" ? event.level : null,
  });
  if (event.kind === "merge") effects.hidden.set(event.id, MERGE_GATHER_MS);
}

/** 펑: 과일 색 즙 방울, 좌우로 튀는 눈물, 떠오르는 별, 퍼지는 고리. 큰 과일·수박이면 화면도 흔들린다 */
function burst(effects: Effects, merging: Merging) {
  const vanish = merging.bornLevel === null;
  const level = merging.bornLevel ?? WATERMELON_LEVEL;
  const radius = FRUITS[level].radius;
  const juice = FRUITS[merging.level].color;
  const spray = (shape: Particle["shape"], count: number, speed: number, color: (i: number) => string, size: () => number, lifeMs: number) => {
    for (let i = 0; i < count; i += 1) {
      const angle = shape === "tear" ? (i % 2 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.1 - 0.5 * (i % 2 ? 1 : -1) : Math.random() * Math.PI * 2;
      const v = speed * (0.55 + Math.random() * 0.7);
      effects.particles.push({
        shape,
        x: merging.x + Math.cos(angle) * radius * 0.4,
        y: merging.y + Math.sin(angle) * radius * 0.4,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - (shape === "star" ? 120 : 80),
        size: size(),
        color: color(i),
        lifeMs: lifeMs * (0.8 + Math.random() * 0.4),
        ageMs: 0,
      });
    }
  };
  spray("dot", vanish ? 36 : 10 + level * 2, vanish ? 420 : 200 + level * 18, (i) => (i % 3 === 2 ? "#ffffff" : juice), () => 2 + Math.random() * (3 + level * 0.35), 650);
  spray("tear", vanish ? 10 : 4 + Math.min(4, level), 170 + level * 10, () => "#7cc4ff", () => 4 + Math.random() * 2 + level * 0.25, 720);
  spray("star", vanish ? 10 : 3 + Math.floor(level / 3), 110, (i) => (vanish ? COMBO_COLORS[i % COMBO_COLORS.length] : "#fde047"), () => 5 + Math.random() * 4, 900);
  effects.rings.push({ x: merging.x, y: merging.y, r: radius, ageMs: 0 });
  if (vanish || level >= SHAKE_LEVEL) {
    effects.shakeMs = vanish ? 450 : 260;
    effects.shakePower = vanish ? 9 : 3 + (level - SHAKE_LEVEL) * 1.5;
  }
}

/** 빨리 떨어지던 과일이 갑자기 멈추면 착지: 납작하게 찌그러지고 양옆으로 먼지가 살짝 퍼진다 */
function detectLandings(effects: Effects, state: GameState, reducedMotion: boolean) {
  const next = new Map<number, number>();
  for (const fruit of state.fruits) {
    const before = effects.lastVy.get(fruit.id) ?? 0;
    if (!reducedMotion && before > IMPACT_SPEED && fruit.vy < before * 0.35) {
      effects.squash.set(fruit.id, 0);
      for (const side of [-1, 1]) {
        effects.particles.push({
          shape: "dust",
          x: fruit.x + side * fruit.r * 0.7,
          y: fruit.y + fruit.r * 0.85,
          vx: side * (50 + Math.random() * 40),
          vy: -30 - Math.random() * 30,
          size: 3 + fruit.r * 0.06,
          color: "rgba(255,255,255,0.7)",
          lifeMs: 380,
          ageMs: 0,
        });
      }
    }
    next.set(fruit.id, fruit.vy);
  }
  effects.lastVy = next;
}

function updateEffects(effects: Effects, ms: number) {
  const dt = ms / 1000;
  for (const particle of effects.particles) {
    particle.ageMs += ms;
    // 별은 둥실 떠오르고, 먼지는 공기에 금방 멈춘다
    particle.vy += (particle.shape === "star" ? 260 : particle.shape === "dust" ? 0 : 900) * dt;
    if (particle.shape === "dust") particle.vx *= 1 - Math.min(1, dt * 4);
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  effects.particles = effects.particles.filter((particle) => particle.ageMs < particle.lifeMs);
  for (const merging of effects.merging) {
    merging.ageMs += ms;
    if (!merging.burst && merging.ageMs >= MERGE_GATHER_MS) {
      merging.burst = true;
      burst(effects, merging);
    }
  }
  effects.merging = effects.merging.filter((merging) => merging.ageMs < MERGE_GATHER_MS + MERGE_POP_MS);
  for (const [id, left] of effects.hidden) {
    if (left - ms > 0) effects.hidden.set(id, left - ms);
    else {
      effects.hidden.delete(id);
      effects.appear.set(id, 0);
    }
  }
  for (const [id, age] of effects.appear) {
    if (age + ms < APPEAR_MS) effects.appear.set(id, age + ms);
    else effects.appear.delete(id);
  }
  for (const [id, age] of effects.squash) {
    if (age + ms < SQUASH_MS) effects.squash.set(id, age + ms);
    else effects.squash.delete(id);
  }
  for (const popup of effects.popups) popup.ageMs += ms;
  effects.popups = effects.popups.filter((popup) => popup.ageMs < POPUP_MS);
  for (const ring of effects.rings) ring.ageMs += ms;
  effects.rings = effects.rings.filter((ring) => ring.ageMs < RING_MS);
  effects.shakeMs = Math.max(0, effects.shakeMs - ms);
}

/** 네 갈래 반짝이 별 (angle만큼 돌려서) */
function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const reach = i % 2 === 0 ? r : r * 0.38;
    const a = (i * Math.PI) / 4;
    if (i === 0) ctx.moveTo(Math.cos(a) * reach, Math.sin(a) * reach);
    else ctx.lineTo(Math.cos(a) * reach, Math.sin(a) * reach);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 눈물 방울: 날아가는 쪽이 둥글고 뒤가 뾰족한 물방울 + 작은 반짝임 */
function drawTear(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, heading: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading - Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.9);
  ctx.quadraticCurveTo(r * 1.1, -r * 0.3, r, r * 0.25);
  ctx.arc(0, r * 0.25, r, 0, Math.PI);
  ctx.quadraticCurveTo(-r * 1.1, -r * 0.3, 0, -r * 1.9);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.arc(-r * 0.35, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 0→1 진행도를 살짝 넘쳤다 돌아오게 (통통 튀어나오기) */
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;

function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  effects: Effects,
  palette: Palette,
  clockMs: number,
  reducedMotion: boolean,
) {
  ctx.save();
  ctx.fillStyle = palette.board;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (effects.shakeMs > 0) {
    const power = effects.shakePower * (effects.shakeMs / 300);
    ctx.translate((Math.random() - 0.5) * power * 2, (Math.random() - 0.5) * power * 2);
  }

  // 경고선: 평소엔 흐린 점선, 과일이 가까이 쌓이면 붉게 깜빡이고, 넘은 채로 있으면 더 빨리 깜빡인다
  const warning = isWarning(state);
  const blinkSpeed = state.dangerMs > 0 ? 90 : 220;
  ctx.globalAlpha = warning ? (reducedMotion ? 0.9 : 0.45 + 0.45 * Math.abs(Math.sin(clockMs / blinkSpeed))) : 0.35;
  ctx.strokeStyle = warning ? palette.danger : palette.line;
  ctx.lineWidth = warning ? 3 : 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(0, DEADLINE_Y);
  ctx.lineTo(GAME_WIDTH, DEADLINE_Y);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 들고 있는 과일과 떨어질 자리 안내선
  if (!state.over) {
    const heldR = FRUITS[state.held].radius;
    const aimX = clampAim(state.aimX, state.held);
    const ready = canDrop(state);
    const appear = ready ? 1 : 1 - state.cooldownMs / DROP_COOLDOWN_MS;
    ctx.globalAlpha = 0.18 * appear;
    ctx.strokeStyle = palette.text;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    ctx.moveTo(aimX, DROP_Y + heldR);
    ctx.lineTo(aimX, GAME_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = appear;
    const bob = reducedMotion ? 0 : Math.sin(clockMs / 320) * 2.5;
    // 떨어뜨린 직후엔 작게 나타나 통통 커지고, 매달린 동안 대롱대롱 좌우로 흔들린다
    const scale = reducedMotion ? 1 : 0.4 + 0.6 * easeOutBack(appear);
    ctx.save();
    ctx.translate(aimX, DROP_Y + bob);
    if (!reducedMotion) ctx.rotate(Math.sin(clockMs / 480) * 0.07);
    drawFruit(ctx, state.held, 0, 0, heldR * scale, false);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  ctx.setLineDash([]);

  const danger = state.dangerMs > 0;
  for (const fruit of state.fruits) {
    // 합쳐져 막 생긴 과일은 두 과일이 모여드는 동안 숨겼다가, 터질 때 통통 튀어나온다
    if (effects.hidden.has(fruit.id)) continue;
    const appearAge = effects.appear.get(fruit.id);
    const pop = appearAge === undefined ? 1 : Math.max(0, easeOutBack(appearAge / APPEAR_MS));
    const age = state.elapsedMs - fruit.bornAt;
    // 떨어뜨린 직후 말랑하게 한 번 출렁 (합쳐져 생긴 과일은 튀어나오기가 대신한다)
    const wobble = reducedMotion || age > 400 || appearAge !== undefined ? 0 : Math.sin(age / 40) * 0.08 * (1 - age / 400);
    // 착지하면 납작하게 눌렸다가 돌아오고, 가만히 있을 땐 숨 쉬듯 살짝 부풀었다 가라앉는다
    const squashAge = effects.squash.get(fruit.id);
    const squash = squashAge === undefined ? 0 : Math.sin((squashAge / SQUASH_MS) * Math.PI) * 0.16;
    const breathe = reducedMotion ? 0 : Math.sin(clockMs / 620 + fruit.id * 1.7) * 0.018;
    // 빨리 떨어지거나, 막 착지했거나, 선을 넘어 위험하면 깜짝 놀란 얼굴
    const scared = fruit.vy > SURPRISE_SPEED || squashAge !== undefined || (danger && fruit.y - fruit.r < DEADLINE_Y);
    const blink = !reducedMotion && (clockMs + fruit.id * 977) % 3400 < 130;
    ctx.save();
    // 찌그러질 땐 바닥에 붙은 채 눌리게 발 쪽(과일 아래)을 기준으로
    ctx.translate(fruit.x, fruit.y + fruit.r);
    ctx.scale(pop * (1 + wobble + squash + breathe), pop * (1 - wobble - squash + breathe));
    drawFruit(ctx, fruit.level, 0, -fruit.r, fruit.r, blink, scared ? "-surprise" : "");
    ctx.restore();
  }

  // 합쳐지는 두 과일: 우는 얼굴로 흔들리며 한가운데로 모여 찌그러졌다가(GATHER), 부풀어 펑 사라진다(POP)
  for (const merging of effects.merging) {
    const radius = FRUITS[merging.level].radius;
    if (merging.ageMs < MERGE_GATHER_MS) {
      const t = merging.ageMs / MERGE_GATHER_MS;
      const pull = t * t;
      const jiggle = Math.sin(merging.ageMs / 22) * 0.1 * (1 - t * 0.5);
      for (const point of merging.from) {
        ctx.save();
        ctx.translate(point.x + (merging.x - point.x) * pull, point.y + (merging.y - point.y) * pull);
        ctx.rotate(jiggle);
        ctx.scale(1 + 0.22 * t, 1 - 0.18 * t);
        drawFruit(ctx, merging.level, 0, 0, radius, false, "-cry");
        ctx.restore();
      }
    } else {
      const u = (merging.ageMs - MERGE_GATHER_MS) / MERGE_POP_MS;
      ctx.save();
      ctx.globalAlpha = (1 - u) ** 2;
      ctx.translate(merging.x, merging.y);
      ctx.scale(1 + 0.5 * u, 1 + 0.5 * u);
      drawFruit(ctx, merging.level, 0, 0, radius * 1.1, false, "-cry");
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  for (const ring of effects.rings) {
    const t = ring.ageMs / RING_MS;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = palette.text;
    ctx.lineWidth = 4 * (1 - t) + 1;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r * (1 + t * 0.6), 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const particle of effects.particles) {
    const t = particle.ageMs / particle.lifeMs;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = particle.color;
    if (particle.shape === "star") drawSparkle(ctx, particle.x, particle.y, particle.size * (1 - t * 0.4), particle.ageMs / 160);
    else if (particle.shape === "tear") drawTear(ctx, particle.x, particle.y, particle.size, Math.atan2(particle.vy, particle.vx));
    else {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (particle.shape === "dust" ? 1 + t : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  for (const popup of effects.popups) {
    const t = popup.ageMs / POPUP_MS;
    const y = popup.y - (reducedMotion ? 0 : t * 50);
    ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    // 콤보 글씨는 크게 튀어나왔다(1.4배→1배) 떠오르며, 콤보가 쌓일수록 색이 바뀐다
    const size = popup.big ? 30 * (reducedMotion ? 1 : 1 + 0.4 * Math.max(0, 1 - t * 5)) : 26;
    ctx.font = `900 ${Math.round(size)}px system-ui, sans-serif`;
    ctx.fillStyle = popup.big ? COMBO_COLORS[Number.parseInt(popup.text, 10) % COMBO_COLORS.length] : "#ffffff";
    ctx.strokeText(popup.text, popup.x, y);
    ctx.fillText(popup.text, popup.x, y);
  }
  ctx.globalAlpha = 1;

  if (state.over) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = palette.danger;
    ctx.fillRect(-20, -20, GAME_WIDTH + 40, GAME_HEIGHT + 40);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** 과일 펠트 그림 (HUD 다음 과일·시작 화면 순서·결과 최대 과일). size는 과일 공 지름 — 판 위 그림과 같은 배율로 그린다 */
function FruitDot({ level, size, className }: { level: number; size: number; className?: string }) {
  const side = Math.round(size * FRUIT_IMAGE_SCALE);
  return (
    <NextImage
      src={`${FRUIT_IMAGE_BASE}/${FRUITS[level].slug}.webp`}
      alt=""
      aria-hidden="true"
      width={side}
      height={side}
      unoptimized
      draggable={false}
      className={cn("inline-block shrink-0 select-none", className)}
      style={{ width: side, height: side }}
    />
  );
}

export function WatermelonGame() {
  const records = useWatermelonRecords();
  // 판에 처음 나오는 과일을 그때 불러오면 캔버스 원 → 그림으로 바뀌며 번쩍이니 들어오자마자 전부 받아 둔다
  useEffect(preloadFruitImages, []);
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdownIndex, setCountdownIndex] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef({ left: false, right: false });
  /** 누른 손가락·마우스를 떼면 떨어뜨린다 */
  const pressingRef = useRef<number | null>(null);
  const dropRequestRef = useRef(false);
  /** rAF 루프는 렌더링과 상관없이 돌아서 멈춤 여부를 ref로 읽는다 */
  const pausedRef = useRef(false);
  const { ref: recordsRef, inView: recordsVisible } = useInView<HTMLElement>(phase === "result");
  useLockPageScroll(phase === "countdown" || phase === "playing");

  function clearInput() {
    keysRef.current = { left: false, right: false };
    pressingRef.current = null;
    dropRequestRef.current = false;
  }

  function changePaused(next: boolean) {
    pausedRef.current = next;
    setPaused(next);
    if (next) clearInput();
  }

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
    const record = { id: String(now), score: state.score, maxLevel: state.maxLevel, at: now };
    const rank = getRank(records, record);
    saveRecords(insertRecord(records, record));
    void submitGameRecord("watermelon-game", record.score, record);
    setResult({ score: record.score, maxLevel: record.maxLevel, recordId: record.id, rank });
    playGameSound(
      rank === 1 && record.score > 0
        ? GAME_SOUNDS.record
        : getWatermelonTier(record.score).minScore >= 1200
          ? GAME_SOUNDS.success
          : GAME_SOUNDS.fail,
    );
    setPhase("result");
  });

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // 색은 하드코딩하지 않고 토큰 값을 읽는다 (플레이 영역은 .dark 범위)
    const css = getComputedStyle(canvas);
    const palette: Palette = {
      board: css.getPropertyValue("--card").trim(),
      line: css.getPropertyValue("--muted-foreground").trim(),
      danger: css.getPropertyValue("--destructive").trim(),
      text: css.getPropertyValue("--foreground").trim(),
    };

    function resize() {
      if (!canvas || !ctx) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      const pixelScale = (ratio * canvas.clientWidth) / GAME_WIDTH;
      ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    }

    const state = createState(Math.random);
    stateRef.current = state;
    const effects = createEffects();
    clearInput();
    resize();
    window.addEventListener("resize", resize);

    let lastAt = performance.now();
    let lastHudKey = "";
    let lastWarnSoundAt = 0;
    let frameId = 0;
    let overTimer: ReturnType<typeof setTimeout> | undefined;

    function tick(now: number) {
      if (!ctx) return;
      if (pausedRef.current) {
        // 기준 시각만 옮겨서 이어할 때 시간이 튀지 않게, 멈춘 동안 resize로 지워져도 다시 그린다
        lastAt = now;
        draw(ctx, state, effects, palette, now, true);
        frameId = requestAnimationFrame(tick);
        return;
      }
      const deltaMs = now - lastAt;
      lastAt = now;

      const { left, right } = keysRef.current;
      if (left !== right) state.aimX = clampAim(state.aimX + (left ? -1 : 1) * AIM_KEY_SPEED * (deltaMs / 1000), state.held);
      if (dropRequestRef.current) {
        dropRequestRef.current = false;
        if (drop(state, Math.random)) playGameSound(DROP_SOUND);
      }

      const events = step(state, deltaMs);
      for (const event of events) {
        addMergeEffects(effects, event, reducedMotion, now);
        if (event.kind === "vanish") playGameSound([...GAME_SOUNDS.explosion, ...GAME_SOUNDS.record]);
        else if (event.kind === "merge") {
          playGameSound(event.level === WATERMELON_LEVEL ? GAME_SOUNDS.success : mergeSound(event.level));
        }
      }
      detectLandings(effects, state, reducedMotion);
      updateEffects(effects, Math.min(deltaMs, 50));
      if (state.dangerMs > 0 && now - lastWarnSoundAt >= WARNING_SOUND_MS) {
        lastWarnSoundAt = now;
        playGameSound(GAME_SOUNDS.warning);
      }
      draw(ctx, state, effects, palette, now, reducedMotion);

      const nextHud: Hud = { score: state.score, next: state.next, warning: state.dangerMs > 0 };
      const hudKey = `${nextHud.score}|${nextHud.next}|${nextHud.warning}`;
      if (hudKey !== lastHudKey) {
        lastHudKey = hudKey;
        setHud(nextHud);
      }

      if (state.over) {
        playGameSound(GAME_SOUNDS.hit);
        draw(ctx, state, effects, palette, now, reducedMotion);
        overTimer = setTimeout(() => finishRound(state), OVER_PAUSE_MS);
        return;
      }
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(overTimer);
      window.removeEventListener("resize", resize);
    };
  }, [phase]);

  function startCountdown() {
    changePaused(false);
    clearInput();
    setHud(null);
    setCountdownIndex(0);
    setPhase("countdown");
  }

  /** 화면 어디를 눌러도 그 가로 위치로 조준한다 (상자 바깥 여백이면 가장자리로) */
  function aimAt(clientX: number) {
    const state = stateRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!state || !rect || rect.width === 0) return;
    state.aimX = clampAim(((clientX - rect.left) / rect.width) * GAME_WIDTH, state.held);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (phase !== "playing" || pausedRef.current || pressingRef.current !== null) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressingRef.current = event.pointerId;
    aimAt(event.clientX);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (phase !== "playing" || pausedRef.current) return;
    // 마우스는 올려만 둬도 따라오고, 터치는 누른 손가락만 따라온다
    if (event.pointerType === "mouse" || pressingRef.current === event.pointerId) aimAt(event.clientX);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (pressingRef.current !== event.pointerId) return;
    pressingRef.current = null;
    if (phase !== "playing" || pausedRef.current) return;
    aimAt(event.clientX);
    dropRequestRef.current = true;
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    if (pressingRef.current === event.pointerId) pressingRef.current = null;
  }

  // 시작/재시작은 click으로 받아 스크롤하려고 끄는 동작에는 반응하지 않게 한다
  function handleClick() {
    if (phase !== "idle" && phase !== "result") return;
    playGameSound(GAME_SOUNDS.start);
    startCountdown();
  }

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    const pressed = event.type === "keydown";
    if (phase === "playing") {
      if (pausedRef.current) return;
      if (LEFT_KEYS.has(event.key) || RIGHT_KEYS.has(event.key)) {
        event.preventDefault();
        if (LEFT_KEYS.has(event.key)) keysRef.current.left = pressed;
        else keysRef.current.right = pressed;
        return;
      }
      if (DROP_KEYS.has(event.key)) {
        if (event.target instanceof HTMLElement && event.target.closest("a, button, input, textarea, select")) return;
        event.preventDefault();
        if (pressed && !event.repeat) dropRequestRef.current = true;
      }
      return;
    }

    if (!pressed || event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    if (event.target instanceof HTMLElement && event.target.closest("a, button, input, textarea, select")) return;
    event.preventDefault();
    handleClick();
  });

  // 키를 누른 채 다른 창으로 가면 keyup을 놓친다 — 돌아와도 조준이 한쪽으로 계속 흘러가지 않게 비운다
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

  const tier = result ? getWatermelonTier(result.score) : null;
  const scoreText = result ? result.score.toLocaleString("ko-KR") : "";
  const biggest = result ? FRUITS[result.maxLevel] : null;

  const screenClass =
    phase === "countdown"
      ? "bg-success text-neutral-950"
      : phase === "result" && tier && !recordsVisible
        ? cn(tier.bgClass, tier.fgClass)
        : "bg-background text-foreground";

  const shareText =
    phase === "result" && result && tier && biggest
      ? `${TITLE}에서 ${scoreText}점, ${biggest.name}까지 만들어서 '${tier.label}' 등급! 수박 만들 수 있어?`
      : "같은 과일끼리 합쳐서 수박까지 키우는 수박 게임, 같이 해 봐요";

  const liveMessage =
    phase === "countdown"
      ? `${COUNTDOWN_VALUES[countdownIndex]}`
      : phase === "playing" && hud?.warning
        ? "과일이 선을 넘었어요"
        : phase === "result" && result && tier
          ? `${result.rank}위, ${scoreText}점, ${tier.label} 등급`
          : "";

  return (
    <div
      data-testid="watermelon-game-screen"
      data-phase={phase}
      data-paused={paused}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
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
        <ShareButton
          className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]"
          title={TITLE}
          text={shareText}
        />
      )}

      {phase === "idle" && (
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <header className="flex flex-col items-center gap-2">
            <h1 className="px-12 text-title-1 font-bold text-text-strong">{TITLE}</h1>
            <p className="text-caption-1 text-balance text-text-caption">
              화면을 좌우로 움직여 자리를 고르고 손을 떼면 과일이 떨어져요. 같은 과일끼리 닿으면 한 단계 큰 과일로 합쳐져요. 키보드는 ←→로 옮기고 Space로 떨어뜨려요. 과일이 빨간 점선을 넘은 채로 2초가 지나면 끝나요.
            </p>
          </header>

          <ol aria-label="과일 합체 순서" className="flex flex-wrap items-end justify-center gap-1.5">
            {FRUITS.map((fruit, level) => (
              <li
                key={fruit.name}
                className="flex flex-col items-center gap-1 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:fill-mode-both"
                style={{ animationDelay: `${level * 60}ms` }}
              >
                <FruitDot level={level} size={10 + level * 3.2} />
                <span className="text-caption-3 text-text-caption">{fruit.name}</span>
              </li>
            ))}
          </ol>

          <p className="text-title-1 font-bold text-text-strong">클릭해서 시작하세요</p>

          <WatermelonLeaderboard records={records} />
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
          <p className="text-title-3 font-semibold text-balance opacity-80">같은 과일끼리 닿게 떨어뜨려 수박까지 키우세요</p>
        </div>
      )}

      {phase === "playing" && (
        // 플레이 영역은 고정 비율 그대로 화면에 들어가는 최대 크기 (기기마다 상자 모양이 같게)
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
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-center gap-3 px-16 pt-[max(1rem,env(safe-area-inset-top))]">
              <p
                data-testid="score"
                className={cn(
                  "rounded-full bg-black/40 px-4 py-1 text-title-1 font-black tabular-nums transition-colors",
                  hud.warning && "bg-destructive/70",
                )}
              >
                <span key={hud.score} className="inline-block motion-safe:animate-in motion-safe:zoom-in-90">
                  {hud.score.toLocaleString("ko-KR")}
                </span>
              </p>
              <p className="flex items-center gap-1.5 rounded-full bg-black/40 py-1 pr-1.5 pl-3 text-caption-1 font-semibold">
                다음
                <FruitDot
                  key={hud.next}
                  level={hud.next}
                  size={22}
                  className="motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:spin-in-45"
                />
                <span className="sr-only">{FRUITS[hud.next].name}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {phase === "result" && result && tier && biggest && (
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <section
            data-testid="result-hero"
            className="flex min-h-[calc(100dvh-5rem)] w-full flex-col items-center justify-center gap-6"
          >
            <div className="flex flex-col items-center gap-3">
              <p data-testid="result-tier" className="rounded-full bg-black/15 px-4 py-1 text-caption-1 font-bold">
                {tier.label}
              </p>
              <p className="flex items-baseline gap-2 font-black tabular-nums">
                <span data-testid="result-score" className="text-[5rem] leading-none sm:text-[7rem]">
                  {scoreText}
                </span>
                <span className="text-title-1">점</span>
              </p>
              <p data-testid="result-rank" className="text-title-2 font-bold tabular-nums">
                {result.rank}위
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              <p data-testid="result-summary" className="text-title-3 font-semibold text-balance">
                {tier.label} {scoreText}점, {tier.description}
              </p>
              <p className="flex items-center gap-2 text-caption-1 font-semibold opacity-90">
                <FruitDot level={result.maxLevel} size={20} className="motion-safe:animate-in motion-safe:zoom-in-50" />
                가장 큰 과일 {biggest.name}
              </p>
            </div>

            <div
              className="flex cursor-default items-center gap-3 rounded-full bg-black/10 py-1.5 pr-1.5 pl-5"
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
            >
              <p className="text-caption-1 font-semibold">이 기록을 친구에게 공유할까요?</p>
              <ShareButton title={TITLE} text={shareText} />
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
            <WatermelonLeaderboard records={records} highlightId={result.recordId} />
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

export default WatermelonGame;
