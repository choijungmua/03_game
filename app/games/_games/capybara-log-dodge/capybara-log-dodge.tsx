"use client";

import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { ShareButton } from "@/components/games/share-button";
import { cn } from "@/lib";
import { submitGameRecord } from "@/lib/games/supabase";
import { useInView } from "@/lib/games/use-in-view";
import { lobbyAssetSrc } from "@/lib/lobby/assets";

import { LogDodgeLeaderboard } from "./leaderboard";
import {
  CAPYBARA_Y,
  createRandom,
  createState,
  formatSeconds,
  GAME_HEIGHT,
  GAME_WIDTH,
  type GameState,
  getCourseDate,
  getCue,
  getDeathLine,
  JUMP_MS,
  type Log,
  LOG_HEIGHTS,
  type LogKind,
  parseChallenge,
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
/** 머리 높이 통나무를 땅(그림자)보다 위로 띄워 그리는 높이(px) */
const BEAM_LIFT = 26;
const TILE_SIZE = 96;
/** 배경이 아래로 흘러가는 속도(px/s) — 카피바라가 위로 달리는 느낌 */
const SCROLL_SPEED = 180;
/** 위·아래로 이만큼(CSS px) 쓸면 점프·숙이기 */
const SWIPE_PX = 36;
/** 이보다 짧고 적게 움직인 터치는 탭(점프)으로 본다 */
const TAP_MS = 250;
const TAP_PX = 10;

const TITLE = "카피바라 통나무 피하기";
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
  nearMissFlash: boolean;
  passedFlash: boolean;
  cue: ReturnType<typeof getCue>;
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
  for (let y = (offsetY % TILE_SIZE) - TILE_SIZE; y < GAME_HEIGHT; y += TILE_SIZE) {
    for (let x = left; x < left + width; x += TILE_SIZE) {
      const w = Math.min(TILE_SIZE, left + width - x);
      ctx.drawImage(image, 0, 0, (image.naturalWidth * w) / TILE_SIZE, image.naturalHeight, x, y, w, TILE_SIZE);
    }
  }
}

function drawLog(ctx: CanvasRenderingContext2D, image: HTMLImageElement, log: Log, shadow: string) {
  if (!ready(image)) return;
  const raised = LOG_HEIGHTS[log.kind] === "high";
  const left = log.x - log.w / 2;
  if (raised) {
    // 머리 높이 통나무: 판정 자리에 그림자를 깔고 통나무는 위로 띄워 그린다
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = shadow;
    ctx.fillRect(left, log.y - log.h / 4, log.w, log.h / 2);
    ctx.globalAlpha = 1;
  }
  // 긴 통나무는 통나무 여러 개를 나란히 놓은 모양으로 그린다
  const segment = log.h * (LOG_SOURCE.width / LOG_SOURCE.height);
  const count = Math.max(1, Math.round(log.w / segment));
  const width = log.w / count;
  const top = log.y - log.h / 2 - (raised ? BEAM_LIFT : 0);
  for (let i = 0; i < count; i += 1) {
    ctx.drawImage(image, 0, 0, LOG_SOURCE.width, LOG_SOURCE.height, left + i * width, top, width, log.h);
  }
}

function drawCapybara(ctx: CanvasRenderingContext2D, state: GameState, sprites: Sprites, clockMs: number, reducedMotion: boolean, shadow: string) {
  const jump = state.jumpMs > 0 ? Math.sin((1 - state.jumpMs / JUMP_MS) * Math.PI) : 0;
  const ducking = state.duckMs > 0 && !state.hitBy;
  const frame = reducedMotion ? "stand" : RUN_FRAMES[Math.floor(clockMs / RUN_FRAME_MS) % RUN_FRAMES.length];
  const image = state.hitBy ? sprites.stun : ducking ? sprites.duck : sprites[`${frame}-${RUN_FACINGS[state.lean + 1]}`];
  if (!ready(image)) return;

  if (jump > 0) {
    // 떠 있는 동안 발밑 그림자가 작아져 높이가 보인다
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(state.x, CAPYBARA_Y + 22, 22 * (1 - jump * 0.35), 7 * (1 - jump * 0.35), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  const size = ducking ? CAPYBARA_SIZE * 0.78 : CAPYBARA_SIZE * (1 + jump * 0.12);
  // 그림 발바닥이 판정 박스 아래쪽에 오게 둔다
  ctx.drawImage(image, state.x - size / 2, CAPYBARA_Y + 26 - size - jump * JUMP_HEIGHT, size, size);
}

function draw(ctx: CanvasRenderingContext2D, state: GameState, sprites: Sprites, clockMs: number, reducedMotion: boolean, shadow: string) {
  const scroll = reducedMotion ? 0 : (state.elapsedMs / 1000) * SCROLL_SPEED;
  drawTiled(ctx, sprites.meadow, 0, GAME_WIDTH, scroll);
  drawTiled(ctx, sprites.mud, 60, GAME_WIDTH - 120, scroll);

  // 바닥 통나무 → 카피바라 → 머리 위를 지나는 통나무 순서로 그린다
  for (const log of state.logs) if (LOG_HEIGHTS[log.kind] !== "high") drawLog(ctx, sprites.log, log, shadow);
  drawCapybara(ctx, state, sprites, clockMs, reducedMotion, shadow);
  for (const log of state.logs) if (LOG_HEIGHTS[log.kind] === "high") drawLog(ctx, sprites.log, log, shadow);
}

function readHud(state: GameState, challengeMs: number | null): Hud {
  return {
    tenths: Math.floor(state.elapsedMs / 100),
    nearMisses: state.nearMisses,
    nearMissFlash: state.lastNearMissAt !== null && state.elapsedMs - state.lastNearMissAt < FLASH_MS,
    passedFlash: challengeMs !== null && state.elapsedMs >= challengeMs && state.elapsedMs - challengeMs < FLASH_MS * 2,
    cue: getCue(state),
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

interface Drag {
  pointerX: number;
  pointerY: number;
  startX: number;
  targetX: number;
  downAt: number;
  /** 누른 뒤 가장 멀리 움직인 거리(CSS px) */
  moved: number;
  /** 이번 터치에서 위·아래 쓸기를 이미 썼는지 */
  swiped: boolean;
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef({ left: false, right: false });
  /** 점프는 다음 프레임에 한 번 소비하고, 숙이기는 키·버튼·쓸기 중 하나라도 누르고 있으면 유지 */
  const actionRef = useRef({ jump: false, duckKey: false, duckButton: false, duckSwipe: false });
  const dragRef = useRef<Drag | null>(null);
  const stateRef = useRef<GameState | null>(null);
  /** 게임 좌표 1px이 화면에서 몇 CSS px인지. 드래그 거리를 게임 좌표로 바꿀 때 쓴다 */
  const scaleRef = useRef(1);
  const { ref: recordsRef, inView: recordsVisible } = useInView<HTMLElement>(phase === "result");

  const course = mode === "daily" ? courseDate : null;
  const courseBest = courseDate ? getCourseBest(records, courseDate) : null;

  useEffect(() => {
    if (phase !== "countdown") return;
    const timers = COUNTDOWN_VALUES.map((_, index) =>
      setTimeout(() => {
        if (index < COUNTDOWN_VALUES.length - 1) {
          setCountdownIndex(index + 1);
          return;
        }
        setPhase("playing");
      }, COUNTDOWN_STEP_MS * (index + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const finishRound = useEffectEvent((state: GameState) => {
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
    // 그림자 색은 하드코딩하지 않고 토큰 값을 읽는다 (플레이 영역은 .dark 범위)
    const shadow = getComputedStyle(canvas).getPropertyValue("--background").trim();
    const sprites = loadSprites();
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
    dragRef.current = null;
    resize();
    window.addEventListener("resize", resize);

    const startAt = performance.now();
    let lastAt = startAt;
    let lastHudKey = "";
    let frameId = 0;
    let hitTimer: ReturnType<typeof setTimeout> | undefined;

    function tick(now: number) {
      const state = stateRef.current;
      if (!state || !ctx) return;
      const { left, right } = keysRef.current;
      const action = actionRef.current;
      // rAF는 백그라운드 탭에서 멈추고, step이 프레임 간격에 상한을 둬서 자연히 일시정지된다
      step(state, now - lastAt, {
        direction: left === right ? 0 : left ? -1 : 1,
        targetX: dragRef.current?.targetX ?? null,
        jump: action.jump,
        duck: action.duckKey || action.duckButton || action.duckSwipe,
      });
      action.jump = false;
      lastAt = now;
      // 움직임 줄이기 설정이면 아슬아슬 슬로모션을 쓰지 않는다
      if (reducedMotion) state.slowmoMs = 0;
      draw(ctx, state, sprites, Math.max(0, now - startAt), reducedMotion, shadow);

      const nextHud = readHud(state, challengeMs);
      const hudKey = Object.values(nextHud).join("|");
      if (hudKey !== lastHudKey) {
        lastHudKey = hudKey;
        setHud(nextHud);
      }

      if (state.hitBy) {
        hitTimer = setTimeout(() => finishRound(state), HIT_PAUSE_MS);
        return;
      }
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
    keysRef.current = { left: false, right: false };
    actionRef.current = { jump: false, duckKey: false, duckButton: false, duckSwipe: false };
    setHud(null);
    setCountdownIndex(0);
    setPhase("countdown");
  }

  // 좌우 드래그는 손가락이 움직인 거리만큼 카피바라를 옮기고(손가락이 카피바라를 가리지 않게),
  // 위로 쓸거나 탭하면 점프, 아래로 쓸면 손을 뗄 때까지 숙인다
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const state = stateRef.current;
    if (phase !== "playing" || !state) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: state.x,
      targetX: state.x,
      downAt: performance.now(),
      moved: 0,
      swiped: false,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (phase !== "playing" || !drag) return;
    const dx = event.clientX - drag.pointerX;
    const dy = event.clientY - drag.pointerY;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    drag.targetX = drag.startX + dx / scaleRef.current;
    if (drag.swiped || Math.abs(dy) < SWIPE_PX || Math.abs(dy) < Math.abs(dx)) return;
    drag.swiped = true;
    if (dy < 0) actionRef.current.jump = true;
    else actionRef.current.duckSwipe = true;
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    if (phase === "playing" && drag && !drag.swiped && drag.moved < TAP_PX && performance.now() - drag.downAt < TAP_MS) {
      actionRef.current.jump = true;
    }
    actionRef.current.duckSwipe = false;
    dragRef.current = null;
  }

  // 시작/재시작은 click으로 받아 스크롤하려고 끄는 동작에는 반응하지 않게 한다
  function handleClick() {
    if (phase === "idle" || phase === "result") startCountdown();
  }

  function releaseDuckButton() {
    actionRef.current.duckButton = false;
  }

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    const pressed = event.type === "keydown";
    if (phase === "playing") {
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
    if (phase === "idle" || phase === "result") startCountdown();
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
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
              비탈 위에서 통나무가 굴러 내려와요. 좌우로 드래그해 피하고, 바닥에 깔린 통나무는 탭하거나 위로 쓸어 점프, 머리 높이로 날아오는 통나무는 아래로 쓸어 숙이세요. 키보드는 방향키(←→ 이동, ↑·Space 점프, ↓ 숙이기)예요. 한 번 맞으면 끝, 아슬아슬하게 스치면 잠깐 느려져요.
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
                  onClick={() => setMode(value)}
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
          <p className="text-title-3 font-semibold text-balance opacity-80">좌우로 피하고 · 바닥 통나무는 점프 · 머리 높이 통나무는 숙이기</p>
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
            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <p className="rounded-full bg-black/40 px-4 py-1 text-title-1 font-black tabular-nums">
                {(hud.tenths / 10).toFixed(1)}초
              </p>
              <p className="flex gap-2 text-caption-1 font-semibold tabular-nums">
                {challenge !== null && <span className="rounded-full bg-black/40 px-3 py-0.5">친구 {challenge}초</span>}
                {hud.nearMisses > 0 && <span className="rounded-full bg-black/40 px-3 py-0.5">아슬아슬 {hud.nearMisses}</span>}
              </p>
              {hud.nearMissFlash && (
                <p className="mt-24 animate-in zoom-in-75 text-title-1 font-black text-warning">아슬아슬!</p>
              )}
              {hud.passedFlash && (
                <p className="mt-4 animate-in zoom-in-75 text-title-1 font-black text-success">친구 추월!</p>
              )}
            </div>
          )}
          {hud?.cue && (
            <p
              data-testid="action-cue"
              className="pointer-events-none absolute inset-x-0 bottom-[34%] animate-in zoom-in-75 text-center text-[2.5rem] font-black text-warning drop-shadow-lg"
            >
              {hud.cue === "jump" ? "점프!" : "숙여!"}
            </p>
          )}
          <div className="absolute inset-x-0 bottom-0 flex justify-between gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              className={actionButtonClass}
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
              className={actionButtonClass}
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

            <div className="flex flex-col items-center gap-1 opacity-80">
              <p className="text-caption-1 font-semibold">탭해서 다시 도전</p>
              <p className="flex items-center gap-1 text-caption-2 font-medium">
                <ChevronDown aria-hidden="true" className="size-4" />
                아래로 내리면 순위 기록이 나와요
              </p>
            </div>
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
            <AdSlot placement="capybara-log-dodge-result" />
          </section>
        </div>
      )}
    </div>
  );
}

export default CapybaraLogDodge;
