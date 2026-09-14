"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { ShareButton } from "@/components/games/share-button";
import { cn } from "@/lib";
import { useInView } from "@/lib/games/use-in-view";

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
  getDeathLine,
  type Log,
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
const TILE_SIZE = 96;
/** 배경이 아래로 흘러가는 속도(px/s) — 카피바라가 위로 달리는 느낌 */
const SCROLL_SPEED = 180;

const TITLE = "카피바라 통나무 피하기";
const LEFT_KEYS = new Set(["ArrowLeft", "a", "A"]);
const RIGHT_KEYS = new Set(["ArrowRight", "d", "D"]);

const CHARACTER_BASE = "/assets/images/characters/capybara";
const LOBBY_BASE = "/assets/images/lobby";
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
  add("log", `${LOBBY_BASE}/log-seat.webp`);
  add("meadow", `${LOBBY_BASE}/texture-meadow.webp`);
  add("mud", `${LOBBY_BASE}/texture-mud.webp`);
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

function drawLog(ctx: CanvasRenderingContext2D, image: HTMLImageElement, log: Log) {
  if (!ready(image)) return;
  // 긴 통나무 벽은 통나무 여러 개를 나란히 놓은 모양으로 그린다
  const segment = log.h * (LOG_SOURCE.width / LOG_SOURCE.height);
  const count = Math.max(1, Math.round(log.w / segment));
  const width = log.w / count;
  const left = log.x - log.w / 2;
  for (let i = 0; i < count; i += 1) {
    ctx.drawImage(image, 0, 0, LOG_SOURCE.width, LOG_SOURCE.height, left + i * width, log.y - log.h / 2, width, log.h);
  }
}

function draw(ctx: CanvasRenderingContext2D, state: GameState, sprites: Sprites, clockMs: number, reducedMotion: boolean) {
  const scroll = reducedMotion ? 0 : (state.elapsedMs / 1000) * SCROLL_SPEED;
  drawTiled(ctx, sprites.meadow, 0, GAME_WIDTH, scroll);
  drawTiled(ctx, sprites.mud, 60, GAME_WIDTH - 120, scroll);

  for (const log of state.logs) drawLog(ctx, sprites.log, log);

  const frame = reducedMotion ? "stand" : RUN_FRAMES[Math.floor(clockMs / RUN_FRAME_MS) % RUN_FRAMES.length];
  const image = state.hitBy ? sprites.stun : sprites[`${frame}-${RUN_FACINGS[state.lean + 1]}`];
  if (ready(image)) {
    // 그림 발바닥이 판정 박스 아래쪽에 오게 둔다
    ctx.drawImage(image, state.x - CAPYBARA_SIZE / 2, CAPYBARA_Y + 26 - CAPYBARA_SIZE, CAPYBARA_SIZE, CAPYBARA_SIZE);
  }
}

function readHud(state: GameState, challengeMs: number | null): Hud {
  return {
    tenths: Math.floor(state.elapsedMs / 100),
    nearMisses: state.nearMisses,
    nearMissFlash: state.lastNearMissAt !== null && state.elapsedMs - state.lastNearMissAt < FLASH_MS,
    passedFlash: challengeMs !== null && state.elapsedMs >= challengeMs && state.elapsedMs - challengeMs < FLASH_MS * 2,
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
  const dragRef = useRef<{ pointerX: number; startX: number; targetX: number } | null>(null);
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
      // rAF는 백그라운드 탭에서 멈추고, step이 프레임 간격에 상한을 둬서 자연히 일시정지된다
      step(state, now - lastAt, {
        direction: left === right ? 0 : left ? -1 : 1,
        targetX: dragRef.current?.targetX ?? null,
      });
      lastAt = now;
      // 움직임 줄이기 설정이면 아슬아슬 슬로모션을 쓰지 않는다
      if (reducedMotion) state.slowmoMs = 0;
      draw(ctx, state, sprites, Math.max(0, now - startAt), reducedMotion);

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
    setHud(null);
    setCountdownIndex(0);
    setPhase("countdown");
  }

  // 드래그는 손가락이 움직인 거리만큼 카피바라를 옮긴다 (손가락이 카피바라를 가리지 않게)
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const state = stateRef.current;
    if (phase !== "playing" || !state) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, startX: state.x, targetX: state.x };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (phase !== "playing" || !drag) return;
    drag.targetX = drag.startX + (event.clientX - drag.pointerX) / scaleRef.current;
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  // 시작/재시작은 click으로 받아 스크롤하려고 끄는 동작에는 반응하지 않게 한다
  function handleClick() {
    if (phase === "idle" || phase === "result") startCountdown();
  }

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    const pressed = event.type === "keydown";
    if (LEFT_KEYS.has(event.key) || RIGHT_KEYS.has(event.key)) {
      if (phase !== "playing") return;
      event.preventDefault();
      if (LEFT_KEYS.has(event.key)) keysRef.current.left = pressed;
      else keysRef.current.right = pressed;
      return;
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

  let shareText = "굴러오는 통나무를 피해 온천까지 달리는 카피바라, 오늘의 코스 몇 초 버틸 수 있어요?";
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
      : phase === "result" && result && tier
        ? `${result.rank}위, ${resultSeconds}초, ${tier.label} 등급`
        : "";

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
              비탈 위에서 통나무가 굴러 내려와요. 화면을 좌우로 드래그하거나 방향키로 카피바라를 움직여 피하세요. 한 번 맞으면 끝, 오래 버틸수록 통나무가 빨라지고 벽·튕기는 통나무·쪼개지는 통나무가 나와요. 아슬아슬하게 스치면 잠깐 느려져요.
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
          <p className="text-title-3 font-semibold opacity-80">좌우로 움직여 통나무를 피하세요</p>
        </div>
      )}

      {phase === "playing" && (
        // 넓은 화면의 바깥 여백: 풀밭 텍스처를 흐리게 깔아 몰입감은 유지한다
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 scale-110 bg-repeat opacity-40 blur-2xl"
          style={{ backgroundImage: `url(${LOBBY_BASE}/texture-meadow.webp)` }}
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
