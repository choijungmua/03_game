"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useEffectEvent, useRef, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { GameControls } from "@/components/games/game-controls";
import { GameOverActions } from "@/components/games/game-over-actions";
import { Leaderboard, TierLabel } from "@/components/games/leaderboard";
import { ShareButton } from "@/components/games/share-button";
import { cn } from "@/lib";
import { countdownSound, GAME_SOUNDS, GAME_TITLES } from "@/lib/games/constants";
import { useLockPageScroll } from "@/lib/games/use-lock-page-scroll";
import { playGameSound } from "@/lib/lobby/settings";

import {
  BAR_Y,
  createRun,
  GROUND,
  type Hazard,
  HEIGHT,
  MAX_HEARTS,
  MAX_SPEED,
  PLAYER_H,
  PLAYER_W,
  PLAYER_X,
  type RunEvent,
  type RunInput,
  type RunState,
  SLIDE_H,
  START_SPEED,
  step,
  WIDTH,
} from "./logic";
import { getRank, getRunTier, insertRecord, LEADERBOARD_SIZE, RUN_TIERS, type RunRecord, saveRecords, useRunRecords } from "./records";

const SLUG = "capybara-run";
const TITLE = GAME_TITLES[SLUG];
const STEP_MS = 1000 / 60;
const SPRITE = "/assets/images/characters/capybara";
const JUMP_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);
const DOWN_KEYS = new Set(["ArrowDown", "KeyS"]);
/** 점수 알림이 위로 떠오르며 사라지는 프레임 */
const POPUP_FRAMES = 50;

type Phase = "idle" | "countdown" | "playing" | "result";

interface Popup {
  text: string;
  /** 장애물을 넘어 받은 점수는 크고 노랗게, 초마다 받는 점수는 작게 */
  big: boolean;
  age: number;
}

function playEvents(events: RunEvent[]) {
  for (const event of events) {
    if (event.type === "jump") playGameSound(GAME_SOUNDS.tap);
    else if (event.type === "double") playGameSound(GAME_SOUNDS.whoosh);
    else if (event.type === "grab") playGameSound(GAME_SOUNDS.place);
    else if (event.type === "hurt") {
      playGameSound(GAME_SOUNDS.hit);
      playGameSound(GAME_SOUNDS.ouch);
    }
    else if (event.type === "over") playGameSound(GAME_SOUNDS.fail);
    else if (event.type === "points" && event.points > 10) playGameSound(GAME_SOUNDS.pickup);
  }
}

// --- 그리기 ---

function drawBackground(context: CanvasRenderingContext2D, state: RunState) {
  const sky = context.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, "#5aa9e6");
  sky.addColorStop(1, "#cfeefd");
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  // 멀수록 느리게 흐르는 산·숲 두 겹
  const layers = [
    { speed: 0.15, color: "#9cc7a4", base: 200, height: 70, period: 260 },
    { speed: 0.45, color: "#5f9e6e", base: 232, height: 46, period: 140 },
  ];
  for (const layer of layers) {
    context.fillStyle = layer.color;
    context.beginPath();
    context.moveTo(0, GROUND);
    const shift = (state.distance * layer.speed) % layer.period;
    for (let x = -layer.period; x <= WIDTH + layer.period; x += layer.period / 2) {
      const peak = (Math.round((x + state.distance * layer.speed - shift) / (layer.period / 2)) % 2) * 0.5 + 0.5;
      context.lineTo(x - shift, layer.base - layer.height * peak);
    }
    context.lineTo(WIDTH, GROUND);
    context.fill();
  }
  context.fillStyle = "#b98a4e";
  context.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);
  context.fillStyle = "#7fb04f";
  context.fillRect(0, GROUND, WIDTH, 6);
  // 땅 무늬가 실제 속도로 흘러 빠르기가 느껴지게
  context.fillStyle = "#a07440";
  for (let x = -(state.distance % 48); x < WIDTH; x += 48) context.fillRect(x, GROUND + 16, 22, 4);
}

/** 속도가 붙으면 화면에 바람 줄이 그어진다 */
function drawSpeedLines(context: CanvasRenderingContext2D, state: RunState) {
  const strength = (state.speed - 10) / (MAX_SPEED - 10);
  if (strength <= 0) return;
  context.strokeStyle = `rgba(255,255,255,${0.15 + strength * 0.45})`;
  context.lineWidth = 2;
  for (let index = 0; index < 4 + strength * 10; index += 1) {
    const y = (index * 53 + state.frame * 7) % (GROUND - 20);
    const x = WIDTH - ((state.frame * state.speed * 2 + index * 197) % (WIDTH + 200));
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 40 + strength * 80, y);
    context.stroke();
  }
}

function drawFire(context: CanvasRenderingContext2D, x: number, w: number, frame: number) {
  const glow = context.createRadialGradient(x + w / 2, GROUND, 4, x + w / 2, GROUND, w * 0.8);
  glow.addColorStop(0, "rgba(255,140,0,0.45)");
  glow.addColorStop(1, "rgba(255,140,0,0)");
  context.fillStyle = glow;
  context.fillRect(x - w * 0.3, GROUND - w * 0.8, w * 1.6, w * 0.8);
  // 혀처럼 날름거리는 불꽃: 기둥마다 높이가 다르게 흔들린다
  for (let flameX = x; flameX < x + w; flameX += 12) {
    const height = 20 + Math.sin(frame * 0.45 + flameX * 0.7) * 6 + Math.sin(frame * 0.9 + flameX) * 3;
    for (const [color, scale] of [
      ["#e8410f", 1],
      ["#ff9f1a", 0.7],
      ["#ffe066", 0.4],
    ] as const) {
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(flameX, GROUND);
      context.quadraticCurveTo(flameX + 2, GROUND - height * scale * 0.6, flameX + 7, GROUND - height * scale);
      context.quadraticCurveTo(flameX + 12, GROUND - height * scale * 0.5, flameX + 14, GROUND);
      context.fill();
    }
  }
}

function drawThorns(context: CanvasRenderingContext2D, x: number, w: number) {
  // 바닥에 깔린 짙은 덤불 위로 덩굴 두 줄이 엉키고, 가시가 위아래로 솟는다
  context.fillStyle = "#2f4a22";
  context.beginPath();
  context.moveTo(x, GROUND);
  for (let bushX = x; bushX <= x + w; bushX += 10) context.lineTo(bushX, GROUND - 14 - Math.abs(Math.sin(bushX * 0.09)) * 8);
  context.lineTo(x + w, GROUND);
  context.fill();
  context.strokeStyle = "#5b3a1f";
  context.lineWidth = 3;
  for (const phase of [0, Math.PI]) {
    context.beginPath();
    for (let vineX = x; vineX <= x + w; vineX += 5) context.lineTo(vineX, GROUND - 14 + Math.sin(vineX * 0.12 + phase) * 7);
    context.stroke();
  }
  context.fillStyle = "#efe6d6";
  for (let spikeX = x + 5; spikeX < x + w - 5; spikeX += 11) {
    const baseY = GROUND - 14 + Math.sin(spikeX * 0.12) * 7;
    const up = Math.round(spikeX / 11) % 2 === 0;
    context.beginPath();
    context.moveTo(spikeX - 3, baseY);
    context.lineTo(spikeX + (up ? 1 : -1), baseY + (up ? -15 : 9));
    context.lineTo(spikeX + 3, baseY);
    context.fill();
  }
  context.fillStyle = "#6a9a3a";
  for (let leafX = x + 10; leafX < x + w; leafX += 28) {
    context.beginPath();
    context.ellipse(leafX, GROUND - 20 + Math.sin(leafX * 0.12) * 6, 6, 3, -0.6, 0, Math.PI * 2);
    context.fill();
  }
}

function drawHazard(context: CanvasRenderingContext2D, hazard: Hazard, state: RunState) {
  const x = hazard.x - state.distance;
  const { w } = hazard;
  if (x > WIDTH || x + w < 0) return;
  switch (hazard.kind) {
    case "fire":
      drawFire(context, x, w, state.frame);
      break;
    case "thorn":
      drawThorns(context, x, w);
      break;
    case "log":
      context.fillStyle = "#8a5a2b";
      context.beginPath();
      context.roundRect(x, GROUND - 30, w, 30, 8);
      context.fill();
      context.fillStyle = "#d9a86c";
      context.beginPath();
      context.ellipse(x + w - 6, GROUND - 15, 6, 13, 0, 0, Math.PI * 2);
      context.fill();
      break;
    case "branch": {
      // 위에서 내려온 굵은 나뭇가지 끝에 잎이 머리 높이까지 늘어진다
      context.fillStyle = "#6b4a2b";
      context.fillRect(x + w / 2 - 6, 0, 12, GROUND - 60);
      context.fillStyle = "#4e8a3a";
      context.beginPath();
      context.ellipse(x + w / 2, GROUND - 58, w / 2 + 8, 30, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#3d7030";
      for (const offset of [-14, 0, 14]) {
        context.beginPath();
        context.ellipse(x + w / 2 + offset, GROUND - 36, 7, 10, 0, 0, Math.PI * 2);
        context.fill();
      }
      break;
    }
    case "bar": {
      // 양 끝에서 줄로 매단 쇠 철봉
      context.strokeStyle = "#7a6a58";
      context.lineWidth = 3;
      for (const postX of [x + 6, x + w - 6]) {
        context.beginPath();
        context.moveTo(postX, 0);
        context.lineTo(postX, BAR_Y);
        context.stroke();
      }
      const metal = context.createLinearGradient(0, BAR_Y - 4, 0, BAR_Y + 4);
      metal.addColorStop(0, "#f2f4f7");
      metal.addColorStop(1, "#8a929e");
      context.fillStyle = metal;
      context.beginPath();
      context.roundRect(x, BAR_Y - 4, w, 8, 4);
      context.fill();
      break;
    }
  }
}

function drawPlayer(context: CanvasRenderingContext2D, state: RunState, sprites: Record<string, HTMLImageElement>) {
  const { player } = state;
  // 다치고 무적인 동안 깜빡인다
  if (state.hurt > 0 && Math.floor(state.hurt / 5) % 2 === 0) return;
  const size = PLAYER_W * 1.9;
  const left = PLAYER_X - size / 2;
  const ready = (image?: HTMLImageElement) => image?.complete && image.naturalWidth > 0;
  // 빨라질수록 다리가 빨리 움직인다
  const stride = Math.max(3, Math.round(9 - state.speed / 3));
  const walk = Math.floor(state.frame / stride) % 2 === 0 ? sprites.walk1 : sprites.walk2;

  if (player.mode === "hang") {
    context.strokeStyle = "#6b4a2b";
    context.lineWidth = 5;
    context.lineCap = "round";
    for (const armX of [PLAYER_X - 8, PLAYER_X + 8]) {
      context.beginPath();
      context.moveTo(armX, player.y - PLAYER_H + 14);
      context.lineTo(armX, BAR_Y);
      context.stroke();
    }
  }
  const image = player.mode === "run" ? walk : player.mode === "slide" ? sprites.walk1 : sprites.stand;
  if (player.mode === "slide") {
    // 납작하게 엎드려 미끄러진다 + 흙먼지
    const height = SLIDE_H * 2.2;
    if (ready(image)) context.drawImage(image, left - 6, player.y - height + 6, size + 12, height);
    context.fillStyle = "rgba(160,116,64,0.6)";
    for (let index = 0; index < 4; index += 1) {
      context.beginPath();
      context.arc(PLAYER_X - 30 - index * 10, GROUND - 4 - ((state.frame + index * 3) % 8), 4 - index * 0.6, 0, Math.PI * 2);
      context.fill();
    }
    return;
  }
  const top = player.y - size + 8;
  context.save();
  if (player.mode === "air" && player.jumps === 2) {
    // 2단 점프는 한 바퀴 돈다
    context.translate(PLAYER_X, top + size / 2);
    context.rotate(Math.min(1, Math.max(0, -player.vy / 11.5)) * Math.PI * 2);
    context.translate(-PLAYER_X, -(top + size / 2));
  }
  if (ready(image)) context.drawImage(image, left, top, size, size);
  else {
    context.fillStyle = "#8b5a2b";
    context.fillRect(PLAYER_X - PLAYER_W / 2, player.y - PLAYER_H, PLAYER_W, PLAYER_H);
  }
  context.restore();
}

function drawHud(context: CanvasRenderingContext2D, state: RunState, popups: Popup[]) {
  context.textAlign = "center";
  context.lineJoin = "round";
  context.font = "bold 26px Pretendard, sans-serif";
  context.lineWidth = 5;
  context.strokeStyle = "rgba(0,0,0,0.35)";
  context.strokeText(state.score.toLocaleString(), WIDTH / 2, 34);
  context.fillStyle = "#ffffff";
  context.fillText(state.score.toLocaleString(), WIDTH / 2, 34);
  // 하트와 속도는 점수 바로 밑 한 줄 (그 아래는 철봉 높이라 비워 둔다)
  context.font = "bold 13px Pretendard, sans-serif";
  context.fillText(`${"❤".repeat(state.hearts)}${"♡".repeat(MAX_HEARTS - state.hearts)}  속도 x${(state.speed / START_SPEED).toFixed(1)}`, WIDTH / 2, 54);
  // 넘을 때마다·1초마다 받은 점수가 점수 밑에서 떠올랐다 사라진다
  popups.forEach((popup, index) => {
    const alpha = 1 - popup.age / POPUP_FRAMES;
    const y = 100 + index * 18 - popup.age * 0.3;
    context.font = popup.big ? "bold 17px Pretendard, sans-serif" : "bold 13px Pretendard, sans-serif";
    context.lineWidth = 4;
    context.strokeStyle = `rgba(0,0,0,${alpha * 0.4})`;
    context.strokeText(popup.text, WIDTH / 2, y);
    context.fillStyle = popup.big ? `rgba(255,214,51,${alpha})` : `rgba(255,255,255,${alpha})`;
    context.fillText(popup.text, WIDTH / 2, y);
  });
}

function draw(context: CanvasRenderingContext2D, state: RunState, popups: Popup[], sprites: Record<string, HTMLImageElement>, shake: number) {
  context.save();
  if (shake > 0) context.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawBackground(context, state);
  for (const hazard of state.hazards) drawHazard(context, hazard, state);
  drawPlayer(context, state, sprites);
  drawSpeedLines(context, state);
  context.restore();
  drawHud(context, state, popups);
}

// --- 화면 ---

const COLUMNS = [
  { key: "score", header: "점수" },
  { key: "time", header: "시간" },
  { key: "tier", header: "등급", align: "right" },
] as const;
const LEGEND = RUN_TIERS.map((tier) => ({ label: tier.label, range: `${tier.minScore.toLocaleString()}점 이상`, dotClass: tier.bgClass }));

function RunLeaderboard({ records, highlightId }: { records: readonly RunRecord[]; highlightId?: string }) {
  const rows = records.map((record) => {
    const tier = getRunTier(record.score);
    return {
      id: record.id,
      cells: {
        score: `${record.score.toLocaleString()}점`,
        time: `${record.seconds}초`,
        tier: <TierLabel label={tier.label} dotClass={tier.bgClass} />,
      },
    };
  });
  return <Leaderboard columns={COLUMNS} rows={rows} size={LEADERBOARD_SIZE} highlightId={highlightId} legendTitle="등급 기준 (점수)" legend={LEGEND} />;
}

export function CapybaraRun() {
  const records = useRunRecords();
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(3);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<RunRecord | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<RunState>(createRun());
  const popups = useRef<Popup[]>([]);
  const shake = useRef(0);
  const input = useRef<RunInput>({ jump: false, down: false });
  const downKeys = useRef(new Set<string>());
  const downPointers = useRef(new Set<number>());
  const sprites = useRef<Record<string, HTMLImageElement>>({});

  useLockPageScroll(phase === "countdown" || phase === "playing");

  useEffect(() => {
    sprites.current = Object.fromEntries(
      [
        ["walk1", "capybara-walk1-right"],
        ["walk2", "capybara-walk2-right"],
        ["stand", "capybara-stand-right"],
      ].map(([key, name]) => {
        const image = new Image();
        image.src = `${SPRITE}/${name}.webp`;
        return [key, image];
      }),
    );
  }, []);

  function syncDown() {
    input.current.down = downKeys.current.size > 0 || downPointers.current.size > 0;
  }

  function startCountdown() {
    playGameSound(GAME_SOUNDS.start);
    game.current = createRun();
    popups.current = [];
    input.current = { jump: false, down: false };
    downKeys.current.clear();
    downPointers.current.clear();
    setResult(null);
    setPaused(false);
    setCount(3);
    setPhase("countdown");
  }

  useEffect(() => {
    if (phase !== "countdown") return;
    playGameSound(countdownSound(count));
    const timer = setTimeout(() => {
      if (count > 1) setCount(count - 1);
      else {
        playGameSound(GAME_SOUNDS.go);
        setPhase("playing");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [phase, count]);

  const finish = useEffectEvent((state: RunState) => {
    const record: RunRecord = { id: crypto.randomUUID(), score: state.score, seconds: Math.floor(state.frame / 60), at: Date.now() };
    saveRecords(insertRecord(records, record));
    setResult(record);
    setPhase("result");
  });

  const tick = useEffectEvent(() => {
    if (paused) return;
    const { state, events } = step(game.current, input.current);
    input.current.jump = false;
    game.current = state;
    playEvents(events);
    popups.current = popups.current.map((popup) => ({ ...popup, age: popup.age + 1 })).filter((popup) => popup.age < POPUP_FRAMES);
    for (const event of events) {
      if (event.type === "points") {
        const big = event.points > 10;
        popups.current = [...popups.current, { text: big ? `+${event.points} ${event.label}!` : `+${event.points}`, big, age: 0 }].slice(-4);
      }
      if (event.type === "hurt") shake.current = 10;
    }
    shake.current = Math.max(0, shake.current - 1);
    if (state.over) finish(state);
  });

  const render = useEffectEvent(() => {
    const context = canvas.current?.getContext("2d");
    if (context) draw(context, game.current, popups.current, sprites.current, shake.current);
  });

  useEffect(() => {
    if (phase !== "playing" && phase !== "countdown") return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const loop = (now: number) => {
      carry = Math.min(carry + now - last, STEP_MS * 5);
      last = now;
      while (phase === "playing" && carry >= STEP_MS) {
        tick();
        carry -= STEP_MS;
      }
      render();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const down = (event: KeyboardEvent) => {
      if (JUMP_KEYS.has(event.code)) {
        event.preventDefault();
        if (!event.repeat) input.current.jump = true;
      } else if (DOWN_KEYS.has(event.code)) {
        event.preventDefault();
        downKeys.current.add(event.code);
        syncDown();
      }
    };
    const up = (event: KeyboardEvent) => {
      downKeys.current.delete(event.code);
      syncDown();
    };
    const blur = () => {
      downKeys.current.clear();
      downPointers.current.clear();
      syncDown();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [phase]);

  // 화면 왼쪽 절반 탭 = 점프, 오른쪽 절반 누르고 있기 = 숙이기
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (phase === "idle") {
      startCountdown();
      return;
    }
    if (phase !== "playing" || paused) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX - rect.left < rect.width / 2) input.current.jump = true;
    else {
      downPointers.current.add(event.pointerId);
      syncDown();
    }
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    downPointers.current.delete(event.pointerId);
    syncDown();
  }

  const tier = result ? getRunTier(result.score) : null;
  const rank = result ? getRank(records, result) : 0;
  const best = records[0]?.score;
  const shareText = result && tier ? `${TITLE} ${result.score.toLocaleString()}점 (${tier.label}) — 나보다 멀리 달릴 수 있어?` : `${TITLE} — 2단 점프로 철봉에 매달려 불길을 건너는 카피바라 러닝 게임`;

  return (
    <div
      className={cn(
        "relative flex min-h-dvh w-dvw flex-col items-center select-none",
        phase === "countdown" ? "bg-success text-neutral-950" : phase === "result" && tier ? cn(tier.bgClass, tier.fgClass) : "bg-background text-foreground",
        phase === "playing" || phase === "countdown" ? "h-dvh touch-none justify-center bg-[#5aa9e6]" : "justify-start",
      )}
      onPointerDown={pointerDown}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      onKeyDown={(event) => {
        if (phase === "idle" && (event.key === "Enter" || event.key === " ")) startCountdown();
      }}
      tabIndex={phase === "idle" ? 0 : -1}
    >
      <GameControls
        pause={phase === "playing" ? { paused, onPause: () => setPaused(true), onResume: () => setPaused(false), onRestart: startCountdown } : undefined}
      />

      {phase === "idle" && (
        <>
          <ShareButton className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]" title={TITLE} text={shareText} />
          <div className="flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 px-4 py-16 text-center">
            <header className="flex flex-col items-center gap-2">
              <h1 className="text-title-1 font-bold">{TITLE}</h1>
              <p className="text-body-2 text-text-alternative">갈수록 빨라지는 길을 점프·2단 점프·숙이기로 달려요</p>
            </header>
            <p className="text-title-3 font-semibold">클릭해서 시작하세요</p>
            <ul className="flex flex-col gap-1 text-caption-1 text-text-caption">
              <li>Space·↑ 점프, 공중에서 한 번 더 누르면 2단 점프</li>
              <li>2단 점프로 철봉을 잡으면 불길·가시덩굴 위를 매달려 건너요</li>
              <li>↓ 숙이기 · 휴대폰은 왼쪽 탭 점프, 오른쪽 누르기 숙이기</li>
              {best !== undefined && <li>내 최고 {best.toLocaleString()}점</li>}
            </ul>
            <div className="w-full">
              <RunLeaderboard records={records} />
            </div>
          </div>
        </>
      )}

      {(phase === "playing" || phase === "countdown") && (
        <canvas
          ref={canvas}
          width={WIDTH}
          height={HEIGHT}
          aria-label="카피바라 런 달리기 길"
          className="max-h-full w-full object-contain"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        />
      )}
      {phase === "countdown" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-success/80">
          <span className="text-[8rem] font-black">{count}</span>
        </div>
      )}

      {phase === "result" && result && tier && (
        <div className="flex w-full flex-col items-center" onPointerDown={(event) => event.stopPropagation()}>
          <section className="flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-4 py-16 text-center">
            <p className="text-title-3 font-semibold">{tier.label}</p>
            <p className="text-[4rem] leading-none font-black">{result.score.toLocaleString()}점</p>
            <p className="text-title-3 font-bold">{rank}위</p>
            <p className="text-body-2 opacity-90">
              {result.seconds}초 달리기, {tier.description}
            </p>
            <div className="flex items-center gap-2 text-body-2">
              이 기록을 친구에게 공유할까요?
              <ShareButton title={TITLE} text={shareText} />
            </div>
            <GameOverActions onRetry={startCountdown} className="max-w-xs" />
          </section>
          <section className="flex w-full flex-col items-center gap-8 bg-background px-4 py-12 text-foreground">
            <div className="w-full max-w-md">
              <RunLeaderboard records={records} highlightId={result.id} />
            </div>
            <div className="w-full max-w-md">
              <AdSlot placement="game-over" />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
