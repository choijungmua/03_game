"use client";

import { ChevronDown } from "lucide-react";
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
  CRY_MS,
  CRY_SPEED,
  DEADLINE_Y,
  DROP_COOLDOWN_MS,
  DROP_SOUND,
  DROP_Y,
  FRUIT_IMAGE_BASE,
  FRUIT_IMAGE_SCALE,
  FRUITS,
  GAME_HEIGHT,
  GAME_WIDTH,
  MERGE_PITCH_STEP,
  MERGE_SOUND,
  WARNING_SOUND_MS,
  WATERMELON_LEVEL,
} from "./constants";
import { WatermelonLeaderboard } from "./leaderboard";
import { canDrop, clampAim, createState, drop, type GameEvent, type GameState, isWarning, step } from "./logic";
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
}

interface Ring {
  x: number;
  y: number;
  r: number;
  ageMs: number;
}

/** 합쳐져 사라지는 과일. 우는 얼굴로 눈물을 뿌리며 좌우로 튀어 오르다 작아진다 */
interface Cry {
  x: number;
  y: number;
  vx: number;
  vy: number;
  level: number;
  ageMs: number;
}

interface Effects {
  particles: Particle[];
  popups: Popup[];
  rings: Ring[];
  cries: Cry[];
  shakeMs: number;
  shakePower: number;
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

/** 펠트 과일 그림. 처음 그릴 때 한 번만 불러오고, 아직 안 왔으면 undefined (그동안은 원·줄무늬로 그린다) */
const fruitImages = new Map<string, HTMLImageElement>();
function fruitImage(level: number, crying: boolean) {
  const slug = crying ? `${FRUITS[level].slug}-cry` : FRUITS[level].slug;
  let image = fruitImages.get(slug);
  if (!image) {
    image = new Image();
    image.src = `${FRUIT_IMAGE_BASE}/${slug}.webp`;
    fruitImages.set(slug, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : undefined;
}

/** 과일 그림: 펠트 그림 한 장. 그림을 아직 못 받았으면 원·줄무늬·광택·얼굴로 대신 그린다 */
function drawFruit(ctx: CanvasRenderingContext2D, level: number, x: number, y: number, r: number, blink: boolean, crying = false) {
  const fruit = FRUITS[level];
  const image = fruitImage(level, crying) ?? (crying ? fruitImage(level, false) : undefined);
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

function addMergeEffects(effects: Effects, event: GameEvent, reducedMotion: boolean) {
  if (event.kind === "drop") return;
  const level = event.kind === "merge" ? event.level : WATERMELON_LEVEL;
  const radius = FRUITS[level].radius;
  effects.popups.push({ x: event.x, y: event.y - radius * 0.3, text: `+${event.points}`, ageMs: 0 });
  if (reducedMotion) return;
  // 합쳐져 사라지는 두 과일이 "우엥" 하고 눈물을 뿌리며 좌우로 튀어 오른다
  const cryLevel = event.kind === "merge" ? event.level - 1 : WATERMELON_LEVEL;
  for (const side of [-1, 1]) {
    effects.cries.push({ x: event.x, y: event.y, vx: side * CRY_SPEED, vy: -CRY_SPEED * 0.8, level: cryLevel, ageMs: 0 });
  }
  effects.rings.push({ x: event.x, y: event.y, r: radius, ageMs: 0 });
  const count = event.kind === "vanish" ? 40 : 8 + level * 2;
  const colors = event.kind === "vanish" ? [FRUITS[WATERMELON_LEVEL].color, "#ef4444", "#fef08a"] : [FRUITS[level].color, "#ffffff"];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * (event.kind === "vanish" ? 420 : 160 + level * 20);
    effects.particles.push({
      x: event.x + Math.cos(angle) * radius * 0.6,
      y: event.y + Math.sin(angle) * radius * 0.6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      size: 2 + Math.random() * (3 + level * 0.4),
      color: colors[i % colors.length],
      lifeMs: 450 + Math.random() * 350,
      ageMs: 0,
    });
  }
  if (event.kind === "vanish" || level >= SHAKE_LEVEL) {
    effects.shakeMs = event.kind === "vanish" ? 450 : 260;
    effects.shakePower = event.kind === "vanish" ? 9 : 3 + (level - SHAKE_LEVEL) * 1.5;
  }
}

function updateEffects(effects: Effects, ms: number) {
  const dt = ms / 1000;
  for (const particle of effects.particles) {
    particle.ageMs += ms;
    particle.vy += 900 * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  effects.particles = effects.particles.filter((particle) => particle.ageMs < particle.lifeMs);
  for (const cry of effects.cries) {
    cry.ageMs += ms;
    cry.vy += 900 * dt;
    cry.x += cry.vx * dt;
    cry.y += cry.vy * dt;
  }
  effects.cries = effects.cries.filter((cry) => cry.ageMs < CRY_MS);
  for (const popup of effects.popups) popup.ageMs += ms;
  effects.popups = effects.popups.filter((popup) => popup.ageMs < POPUP_MS);
  for (const ring of effects.rings) ring.ageMs += ms;
  effects.rings = effects.rings.filter((ring) => ring.ageMs < RING_MS);
  effects.shakeMs = Math.max(0, effects.shakeMs - ms);
}

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
    // 떨어뜨린 직후엔 작게 나타나 커진다
    const scale = reducedMotion ? 1 : 0.55 + 0.45 * appear;
    drawFruit(ctx, state.held, aimX, DROP_Y + bob, heldR * scale, false);
    ctx.globalAlpha = 1;
  }
  ctx.setLineDash([]);

  for (const fruit of state.fruits) {
    const age = state.elapsedMs - fruit.bornAt;
    // 생긴 직후 말랑하게 한 번 출렁
    const wobble = reducedMotion || age > 400 ? 0 : Math.sin(age / 40) * 0.08 * (1 - age / 400);
    const blink = !reducedMotion && (clockMs + fruit.id * 977) % 3400 < 130;
    ctx.save();
    ctx.translate(fruit.x, fruit.y);
    ctx.scale(1 + wobble, 1 - wobble);
    drawFruit(ctx, fruit.level, 0, 0, fruit.r, blink);
    ctx.restore();
  }

  // 합쳐져 사라진 과일: 우는 얼굴로 빙글 돌며 튀어 오르다 작아진다
  for (const cry of effects.cries) {
    const t = cry.ageMs / CRY_MS;
    ctx.save();
    ctx.globalAlpha = 1 - t * t;
    ctx.translate(cry.x, cry.y);
    ctx.rotate(Math.sign(cry.vx) * t * 0.7);
    drawFruit(ctx, cry.level, 0, 0, FRUITS[cry.level].radius * (1 - t * 0.45), false, true);
    ctx.restore();
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
    ctx.globalAlpha = 1 - particle.ageMs / particle.lifeMs;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 26px system-ui, sans-serif";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.fillStyle = "#ffffff";
  for (const popup of effects.popups) {
    const t = popup.ageMs / POPUP_MS;
    const y = popup.y - (reducedMotion ? 0 : t * 50);
    ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
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

/** 과일 색 동그라미 (HUD 다음 과일·시작 화면 순서·결과 최대 과일) */
function FruitDot({ level, size, className }: { level: number; size: number; className?: string }) {
  const fruit = FRUITS[level];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 rounded-full shadow-[inset_-3px_-4px_0_rgba(0,0,0,0.18)]", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: fruit.color,
        backgroundImage: fruit.stripe
          ? `repeating-linear-gradient(90deg, transparent 0 ${size / 6}px, ${fruit.stripe} ${size / 6}px ${size / 4}px)`
          : undefined,
      }}
    />
  );
}

export function WatermelonGame() {
  const records = useWatermelonRecords();
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
    const effects: Effects = { particles: [], popups: [], rings: [], cries: [], shakeMs: 0, shakePower: 0 };
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
        addMergeEffects(effects, event, reducedMotion);
        if (event.kind === "vanish") playGameSound([...GAME_SOUNDS.explosion, ...GAME_SOUNDS.record]);
        else if (event.kind === "merge") {
          playGameSound(event.level === WATERMELON_LEVEL ? GAME_SOUNDS.success : mergeSound(event.level));
        }
      }
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
