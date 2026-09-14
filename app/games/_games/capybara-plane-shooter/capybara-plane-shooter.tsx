"use client";

import { ChevronDown, Heart } from "lucide-react";
import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { GameControls } from "@/components/games/game-controls";
import { ShareButton } from "@/components/games/share-button";
import { cn } from "@/lib";
import { GAME_TITLES } from "@/lib/games/constants";
import { submitGameRecord } from "@/lib/games/game-events";
import { useInView } from "@/lib/games/use-in-view";
import { useLockPageScroll } from "@/lib/games/use-lock-page-scroll";

import { PlaneShooterLeaderboard } from "./leaderboard";
import {
  BOSS_PATTERN_LABELS,
  CHARGE_WINDUP_MS,
  createState,
  EXPLOSION_MS,
  type GameInput,
  type GameState,
  getBossHomeY,
  getBossLeftMs,
  getBossPattern,
  getPlaneY,
  getStageConfig,
  ITEMS,
  MAX_HP,
  step,
  type WeaponKind,
} from "./logic";
import { formatScore, getRank, insertRecord, saveRecords, usePlaneShooterRecords } from "./records";
import {
  BULLET_SPRITES,
  CAPYBARA_SPRITES,
  ENEMY_SPRITES,
  EXPLOSION_FRAMES,
  FLAME_FRAMES,
  getBackgroundSpriteKey,
  isSpriteReady,
  ITEM_SPRITES,
  loadSprites,
  PLANE_SPRITES,
  SHOT_SPRITES,
  type SpriteImages,
  SPRITES,
  TIER_SPRITES,
} from "./sprites";
import { getPlaneShooterTier, PLANE_SHOOTER_TIERS } from "./tiers";

export const COUNTDOWN_VALUES = [3, 2, 1] as const;
export const COUNTDOWN_STEP_MS = 800;

const TITLE = GAME_TITLES["capybara-plane-shooter"];
const LEFT_KEYS = new Set(["ArrowLeft", "a", "A"]);
const RIGHT_KEYS = new Set(["ArrowRight", "d", "D"]);

/**
 * 게임 세계 크기는 기기와 상관없이 고정이다. 화면에는 이 비율 그대로 확대·축소만 해서 맞추므로
 * 폰이든 PC든 보이는 범위·적 속도·탄 간격이 모두 같다
 */
const GAME_WIDTH = 450;
const GAME_HEIGHT = 800;

/** 게임 안에서 그리는 크기(px). 판정 반경에 맞춰 잡는다 */
const PLANE_SIZE = 46;
const FLAME_WIDTH = 14;
const FLAME_HEIGHT = 19;
const FLAME_FRAME_MS = 90;
const ENEMY_SIZE_RATIO = 2.5;
const SHOT_SIZE_RATIO = 2.6;
const ITEM_SIZE_RATIO = 2.4;
const BANNER_CAPYBARA_SIZE = 96;
/** 아래 습지 풍경이 흘러가는 속도 (px/초) */
const BACKGROUND_SCROLL_SPEED = 40;

type Phase = "idle" | "countdown" | "playing" | "result";

interface RoundResult {
  score: number;
  stage: number;
  recordId: string;
  rank: number;
}

interface Hud {
  hp: number;
  stage: number;
  score: number;
  weapon: WeaponKind;
  bossLeftSec: number | null;
  /** 보스가 지금 쓰는 패턴 이름 (보스가 없으면 null) */
  bossPattern: string | null;
  killsLeft: number;
}

interface Palette {
  text: string;
  danger: string;
  font: string;
}

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

/** 캔버스 글자색은 하드코딩하지 않고 토큰 값을 읽는다 (플레이 화면은 .dark 범위라 어두운 습지 배경 위에서 밝게 보인다) */
function readPalette(canvas: HTMLCanvasElement): Palette {
  const style = getComputedStyle(canvas);
  return {
    text: style.getPropertyValue("--foreground").trim(),
    danger: style.getPropertyValue("--destructive").trim(),
    font: style.fontFamily,
  };
}

function readHud(state: GameState): Hud {
  const bossLeftMs = getBossLeftMs(state);
  return {
    hp: state.hp,
    stage: state.stage,
    score: state.score,
    weapon: state.weapon,
    bossLeftSec: bossLeftMs === null ? null : Math.ceil(bossLeftMs / 1000),
    bossPattern: state.enemies.some((enemy) => enemy.kind === "boss")
      ? BOSS_PATTERN_LABELS[getBossPattern(state)]
      : null,
    killsLeft: Math.max(0, getStageConfig(state.stage).killGoal - state.stageKills),
  };
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height = width,
) {
  if (!isSpriteReady(image)) return;
  ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
}

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState, sprites: SpriteImages, scrollMs: number) {
  const background = sprites[getBackgroundSpriteKey(state.stage)];
  if (!isSpriteReady(background)) {
    ctx.clearRect(0, 0, state.width, state.height);
    return;
  }
  // 가로를 꽉 채우고, 세로로 이어 붙여 아래로 흘려보낸다 (위아래가 이어지게 만든 타일)
  const tileHeight = background.naturalHeight * (state.width / background.naturalWidth);
  const offset = ((scrollMs / 1000) * BACKGROUND_SCROLL_SPEED) % tileHeight;
  for (let y = offset - tileHeight; y < state.height; y += tileHeight) {
    ctx.drawImage(background, 0, y, state.width, tileHeight);
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  sprites: SpriteImages,
  palette: Palette,
  clockMs: number,
  reducedMotion: boolean,
) {
  // 움직임 줄이기 설정이면 배경 스크롤·불꽃 깜빡임·아이템 맥동을 멈춘다
  drawBackground(ctx, state, sprites, reducedMotion ? 0 : clockMs);

  const boss = state.enemies.find((enemy) => enemy.kind === "boss");
  if (boss && getBossPattern(state) === "charge" && state.bossPatternMs > 0 && state.bossPatternMs < CHARGE_WINDUP_MS) {
    // 돌격 예고: 보스가 내리꽂을 길을 붉게 칠해 옆으로 비켜날 시간을 준다
    const homeY = getBossHomeY(state);
    ctx.fillStyle = palette.danger;
    ctx.globalAlpha = reducedMotion ? 0.3 : 0.22 + 0.1 * Math.sin(clockMs / 90);
    ctx.fillRect(state.bossChargeX - boss.r, homeY, boss.r * 2, state.height - homeY);
    ctx.globalAlpha = 1;
  }

  for (const item of state.items) {
    const pulse = reducedMotion ? 1 : 1 + 0.08 * Math.sin(clockMs / 180 + item.x);
    drawSprite(ctx, sprites[ITEM_SPRITES[item.kind]], item.x, item.y, item.r * ITEM_SIZE_RATIO * pulse);
  }

  for (const enemy of state.enemies) {
    const sprite = ENEMY_SPRITES[enemy.kind];
    drawSprite(ctx, sprites[enemy.flashMs > 0 ? sprite.hit : sprite.normal], enemy.x, enemy.y, enemy.r * ENEMY_SIZE_RATIO);
  }

  for (const explosion of state.explosions) {
    const frame = Math.min(EXPLOSION_FRAMES.length - 1, Math.floor((explosion.ageMs / EXPLOSION_MS) * EXPLOSION_FRAMES.length));
    drawSprite(ctx, sprites[EXPLOSION_FRAMES[frame]], explosion.x, explosion.y, explosion.size);
  }

  for (const bullet of state.bullets) {
    const { sprite, width, height } = BULLET_SPRITES[bullet.weapon];
    drawSprite(ctx, sprites[sprite], bullet.x, bullet.y, width, height);
  }

  for (const shot of state.shots) {
    drawSprite(ctx, sprites[shot.fromBoss ? SHOT_SPRITES.boss : SHOT_SPRITES.enemy], shot.x, shot.y, shot.r * SHOT_SIZE_RATIO);
  }

  const x = state.planeX;
  const y = getPlaneY(state);
  // 맞은 뒤 무적 시간에는 어지러워하는 조종사 그림 + 반투명 (깜빡임은 광과민 우려로 쓰지 않는다)
  ctx.globalAlpha = state.invincibleMs > 0 ? 0.7 : 1;
  const flame = reducedMotion ? 0 : Math.floor(clockMs / FLAME_FRAME_MS) % FLAME_FRAMES.length;
  drawSprite(ctx, sprites[FLAME_FRAMES[flame]], x, y + PLANE_SIZE / 2 + FLAME_HEIGHT / 2 - 6, FLAME_WIDTH, FLAME_HEIGHT);
  const planeSprite =
    state.invincibleMs > 0
      ? PLANE_SPRITES.hurt
      : state.bank < 0
        ? PLANE_SPRITES.left
        : state.bank > 0
          ? PLANE_SPRITES.right
          : PLANE_SPRITES.center;
  drawSprite(ctx, sprites[planeSprite], x, y, PLANE_SIZE);
  ctx.globalAlpha = 1;

  if (state.bannerMs > 0) {
    const bossStage = getStageConfig(state.stage).boss;
    // 일반 스테이지는 경례하는 카피바라, 보스 스테이지는 헬멧 쓰고 긴장한 카피바라
    drawSprite(
      ctx,
      sprites[bossStage ? CAPYBARA_SPRITES.bossBanner : CAPYBARA_SPRITES.stageBanner],
      state.width / 2,
      state.height * 0.42 - 84,
      BANNER_CAPYBARA_SIZE,
    );
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.text;
    ctx.font = `bold 36px ${palette.font}`;
    ctx.fillText(`스테이지 ${state.stage}`, state.width / 2, state.height * 0.42);
    ctx.font = `600 16px ${palette.font}`;
    ctx.fillText(
      bossStage ? "카이만 보스는 쓰러지지 않아요. 끝까지 버티세요" : "천적들을 모두 격추하세요",
      state.width / 2,
      state.height * 0.42 + 36,
    );
  }
}

export function CapybaraPlaneShooter() {
  const records = usePlaneShooterRecords();
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdownIndex, setCountdownIndex] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef({ left: false, right: false });
  const dragRef = useRef<{ pointerX: number; planeX: number; targetX: number } | null>(null);
  const stateRef = useRef<GameState | null>(null);
  /** 게임 좌표 1px이 화면에서 몇 CSS px인지. 드래그 거리를 게임 좌표로 바꿀 때 쓴다 */
  const scaleRef = useRef(1);
  /** rAF 루프는 렌더링과 상관없이 돌아서 멈춤 여부를 ref로 읽는다 */
  const pausedRef = useRef(false);
  const { ref: recordsRef, inView: recordsVisible } = useInView<HTMLElement>(phase === "result");
  useLockPageScroll(phase === "countdown" || phase === "playing");

  // 멈출 때 입력을 비운다 — 방향키를 누른 채 멈추면 keyup을 놓쳐 이어할 때 한쪽으로 흘러간다
  function changePaused(next: boolean) {
    pausedRef.current = next;
    setPaused(next);
    if (next) {
      keysRef.current = { left: false, right: false };
      dragRef.current = null;
    }
  }

  // 시작 화면에서 미리 불러와 카운트다운이 끝날 때쯤 준비되게 한다
  useEffect(() => {
    void loadSprites();
  }, []);

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

  const finishRound = useEffectEvent((score: number, stage: number) => {
    changePaused(false);
    const now = Date.now();
    const record = { id: String(now), score, stage, at: now };
    const rank = getRank(records, record);
    saveRecords(insertRecord(records, record));
    void submitGameRecord("capybara-plane-shooter", record.score, record);
    setResult({ score, stage, recordId: record.id, rank });
    setPhase("result");
  });

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const palette = readPalette(canvas);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      if (!canvas || !ctx) return;
      // 캔버스 픽셀은 화면 크기에 맞추고, 그리기는 고정된 게임 좌표로 한다
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      scaleRef.current = canvas.clientWidth / GAME_WIDTH;
      const pixelScale = ratio * scaleRef.current;
      ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
      stateRef.current ??= createState(GAME_WIDTH, GAME_HEIGHT);
    }

    stateRef.current = null;
    dragRef.current = null;
    resize();
    window.addEventListener("resize", resize);

    let cancelled = false;
    let frameId = 0;

    void loadSprites().then((sprites) => {
      if (cancelled) return;
      const startAt = performance.now();
      let lastAt = startAt;
      let lastHudKey = "";

      function tick(now: number) {
        const state = stateRef.current;
        if (!state || !ctx) return;
        if (pausedRef.current) {
          // step은 건너뛰고 기준 시각만 옮긴다 → 이어할 때 시간이 튀지 않음. 멈춘 동안 resize로 캔버스가 지워져도 다시 그림
          lastAt = now;
          draw(ctx, state, sprites, palette, Math.max(0, now - startAt), reducedMotion);
          frameId = requestAnimationFrame(tick);
          return;
        }
        const { left, right } = keysRef.current;
        const input: GameInput = {
          direction: left === right ? 0 : left ? -1 : 1,
          targetX: dragRef.current?.targetX ?? null,
        };
        // rAF는 백그라운드 탭에서 멈추고, step이 프레임 간격에 상한을 둬서 자연히 일시정지된다
        step(state, now - lastAt, input);
        lastAt = now;
        // rAF가 넘기는 now는 프레임 시작 시각이라 startAt보다 앞설 수 있다. 음수면 애니메이션 프레임 번호가 -1이 되어 그림을 못 찾는다
        draw(ctx, state, sprites, palette, Math.max(0, now - startAt), reducedMotion);

        // HUD는 값이 바뀔 때만 다시 그린다
        const nextHud = readHud(state);
        const hudKey = Object.values(nextHud).join("|");
        if (hudKey !== lastHudKey) {
          lastHudKey = hudKey;
          setHud(nextHud);
        }

        if (state.hp <= 0) {
          finishRound(state.score, state.stage);
          return;
        }
        frameId = requestAnimationFrame(tick);
      }

      frameId = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, [phase]);

  function startCountdown() {
    changePaused(false);
    keysRef.current = { left: false, right: false };
    setHud(null);
    setCountdownIndex(0);
    setPhase("countdown");
  }

  // 드래그는 손가락이 움직인 거리만큼 비행기를 옮긴다 (손가락이 비행기를 가리지 않게)
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const state = stateRef.current;
    if (phase !== "playing" || !state || pausedRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, planeX: state.planeX, targetX: state.planeX };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (phase !== "playing" || !drag) return;
    drag.targetX = drag.planeX + (event.clientX - drag.pointerX) / scaleRef.current;
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
      if (phase !== "playing" || pausedRef.current) return;
      event.preventDefault();
      if (LEFT_KEYS.has(event.key)) keysRef.current.left = pressed;
      else keysRef.current.right = pressed;
      return;
    }

    if (!pressed || event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    if (event.target instanceof HTMLElement && event.target.closest("a, button, input, textarea, select")) {
      return;
    }
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

  const tier = result ? getPlaneShooterTier(result.stage) : null;

  const screenClass =
    phase === "countdown"
      ? "bg-success text-neutral-950"
      : phase === "result" && tier && !recordsVisible
        ? cn(tier.bgClass, tier.fgClass)
        : "bg-background text-foreground";

  const shareText =
    phase === "result" && result && tier
      ? `${TITLE}에서 스테이지 ${result.stage}까지 가서 ${formatScore(result.score)}점, ${tier.label} 등급이 나왔어요. 나보다 멀리 갈 수 있나요?`
      : `간식으로 무기를 바꿔 가며 천적들을 격추하고 카이만 보스를 버티는 ${TITLE}, 같이 해 봐요`;

  const liveMessage =
    phase === "countdown"
      ? `${COUNTDOWN_VALUES[countdownIndex]}`
      : phase === "playing" && hud
        ? `스테이지 ${hud.stage}, 체력 ${hud.hp}`
        : phase === "result" && result && tier
          ? `${result.rank}위, ${formatScore(result.score)}점, 스테이지 ${result.stage}, ${tier.label} 등급`
          : "";

  return (
    <div
      data-testid="capybara-plane-shooter-screen"
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
        <ShareButton
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]"
          title={TITLE}
          text={shareText}
        />
      )}

      {phase === "idle" && (
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <header className="flex flex-col items-center gap-2">
            <Image
              src={SPRITES[CAPYBARA_SPRITES.hero]}
              alt="유자를 머리에 얹고 고글 모자를 쓴 카피바라 조종사"
              width={144}
              height={144}
              priority
            />
            {/* 좌우 여백: 좁은 폰에서 제목이 오른쪽 위 공유 버튼 밑으로 들어가지 않게 */}
            <h1 className="px-12 text-title-1 font-bold text-text-strong">{TITLE}</h1>
            <p className="text-caption-1 text-balance text-text-caption">
              카피바라 조종사가 풀잎탄을 자동으로 쏴요. 화면을 좌우로 드래그하거나 방향키로 움직여 하피독수리·말벌·재규어를 격추하세요. 떨어진 간식을 먹으면 무기가 바뀌고, 5스테이지마다 나오는 카이만 보스는 쓰러지지 않으니 끝까지 버티세요. 체력은 {MAX_HP}칸이에요.
            </p>
          </header>

          <p className="text-title-1 font-bold text-text-strong">클릭해서 시작하세요</p>

          <PlaneShooterLeaderboard records={records} />
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
          <p className="text-title-3 font-semibold opacity-80">좌우로 움직여 적을 격추하세요</p>
        </div>
      )}

      {phase === "playing" && (
        // 넓은 화면의 바깥 여백: 지금 스테이지 배경을 크게 흐리고 어둡게 깔아 몰입감은 유지한다
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
          style={{ backgroundImage: `url(${SPRITES[getBackgroundSpriteKey(hud?.stage ?? 1)]})` }}
        />
      )}

      {phase === "playing" && (
        // 기기마다 보이는 범위가 달라지면 넓은 화면이 유리하다. 플레이 영역은 고정 비율(GAME_WIDTH:GAME_HEIGHT)
        // 그대로 화면에 들어가는 최대 크기로 가운데 두고, 남는 곳은 흐린 배경이 채운다 (전체 화면 원칙의 예외, 사용자 요청)
        // 습지 배경은 어두운 그림이라 테마와 상관없이 플레이 화면은 다크 토큰으로 글자를 그린다
        // 크기는 Tailwind 임의값 클래스가 생성되지 않아 인라인 스타일로 고정한다
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
            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex min-h-11 w-full items-start justify-between gap-3 px-16">
                <div className="flex flex-col gap-1">
                  <p className="flex gap-0.5" aria-label={`체력 ${hud.hp}/${MAX_HP}`}>
                    {Array.from({ length: MAX_HP }, (_, index) => (
                      <Heart
                        key={index}
                        aria-hidden="true"
                        className={cn("size-5 text-destructive", index < hud.hp ? "fill-current" : "opacity-40")}
                      />
                    ))}
                  </p>
                  <p className="text-caption-2 font-semibold whitespace-nowrap">{ITEMS[hud.weapon].label}</p>
                </div>
                <p className="text-title-3 font-bold tabular-nums">{formatScore(hud.score)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1 px-4">
                <p className="whitespace-nowrap rounded-full bg-black/30 px-3 py-1 text-caption-1 font-bold tabular-nums">
                  스테이지 {hud.stage} ·{" "}
                  {hud.bossLeftSec !== null ? `보스 버티기 ${hud.bossLeftSec}초` : `남은 적 ${hud.killsLeft}`}
                </p>
                {hud.bossPattern && (
                  <p className="whitespace-nowrap rounded-full bg-destructive/85 px-2.5 py-0.5 text-caption-2 font-bold text-white">
                    {hud.bossPattern}
                  </p>
                )}
              </div>
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
              <Image
                src={SPRITES[TIER_SPRITES[PLANE_SHOOTER_TIERS.indexOf(tier)]]}
                alt={`${tier.label} 등급 카피바라`}
                width={120}
                height={120}
              />
              <p data-testid="result-tier" className="rounded-full bg-black/15 px-4 py-1 text-caption-1 font-bold">
                {tier.label}
              </p>
              <p className="flex items-baseline gap-2 font-black tabular-nums">
                <span data-testid="result-score" className="text-[5rem] leading-none sm:text-[7rem]">
                  {formatScore(result.score)}
                </span>
                <span className="text-title-1">점</span>
              </p>
              <p data-testid="result-rank" className="text-title-2 font-bold tabular-nums">
                {result.rank}위
              </p>
            </div>

            <p data-testid="result-summary" className="text-title-3 font-semibold text-balance">
              {tier.label} 스테이지 {result.stage} 도달, {tier.description}
            </p>

            <div
              className="flex cursor-default items-center gap-3 rounded-full bg-black/10 py-1.5 pr-1.5 pl-5"
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
            >
              <p className="text-caption-1 font-semibold">이 기록을 친구에게 공유할까요?</p>
              <ShareButton title={TITLE} text={shareText} />
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
            <PlaneShooterLeaderboard records={records} highlightId={result.recordId} />
            <AdSlot placement="capybara-plane-shooter-result" />
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

export default CapybaraPlaneShooter;
