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

import { RUN_SOUNDS } from "./constants";
import { BANNER_FRAMES, draw, type Effects, IMAGE_BASE, type Images, POPUP_FRAMES, viewFor } from "./draw";
import { createRun, GROUND, PLAYER_X, type RunEvent, type RunInput, type RunState, STAGE_NAMES, step } from "./logic";
import { getRank, getRunTier, insertRecord, LEADERBOARD_SIZE, RUN_TIERS, type RunRecord, saveRecords, useRunRecords } from "./records";
import { SPRITE_SIZES } from "./sprites";

const SLUG = "capybara-run";
const TITLE = GAME_TITLES[SLUG];
const STEP_MS = 1000 / 60;
const JUMP_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);
const DOWN_KEYS = new Set(["ArrowDown", "KeyS"]);
const IMAGE_NAMES = [...Object.keys(SPRITE_SIZES), "bg-far"] as (keyof Images)[];

type Phase = "idle" | "countdown" | "playing" | "result";

function emptyEffects(): Effects {
  return { particles: [], popups: [], banner: null, shake: 0, flash: 0 };
}

function burst(effects: Effects, x: number, y: number, count: number, color: string, spread: number, up: number) {
  for (let index = 0; index < count; index += 1) {
    const life = 18 + Math.random() * 16;
    effects.particles.push({ x, y, vx: (Math.random() - 0.5) * spread, vy: -Math.random() * up, life, max: life, size: 1.2 + Math.random() * 2, color });
  }
}

const DUST = "rgba(190,150,100,0.8)";

/** 이벤트 → 소리·파티클·점수 알림 */
function react(effects: Effects, events: RunEvent[], state: RunState) {
  const feet = state.player.y;
  for (const event of events) {
    switch (event.type) {
      case "jump":
        playGameSound(RUN_SOUNDS.jump);
        burst(effects, PLAYER_X - 6, feet, 6, DUST, 3, 1.5);
        break;
      case "double":
        playGameSound(RUN_SOUNDS.double);
        burst(effects, PLAYER_X, feet - 10, 10, "rgba(255,255,255,0.9)", 4, 2);
        break;
      case "land":
        playGameSound(RUN_SOUNDS.land);
        burst(effects, PLAYER_X, feet, 8, DUST, 4, 1.2);
        break;
      case "grab":
        playGameSound(RUN_SOUNDS.grab);
        burst(effects, PLAYER_X, feet - 46, 8, "rgba(255,240,170,0.95)", 4, 2);
        break;
      case "coin":
        playGameSound(RUN_SOUNDS.coin);
        burst(effects, event.x, event.y, 7, "rgba(255,220,90,0.95)", 3, 2.5);
        effects.popups.push({ text: "+10", x: event.x, y: event.y - 10, big: false, age: 0 });
        break;
      case "bonus":
        playGameSound(RUN_SOUNDS.bonus);
        effects.banner = { title: `코인 올클리어! +${event.points}`, icon: "crown", age: 0 };
        break;
      case "stage":
        playGameSound(RUN_SOUNDS.stage);
        effects.banner = { title: `STAGE ${event.stage}`, sub: `${STAGE_NAMES[event.stage]} · 보너스 타임!`, icon: "star", age: 0 };
        break;
      case "bonusStart":
        // 스테이지 시작과 같이 오면 스테이지 배너를 그대로 둔다
        if (events.some((other) => other.type === "stage")) break;
        playGameSound(RUN_SOUNDS.stage);
        effects.banner = { title: "보너스 타임!", sub: "무적 · 코인 두 배", icon: "star", age: 0 };
        break;
      case "spring":
        playGameSound(RUN_SOUNDS.spring);
        burst(effects, PLAYER_X, feet, 10, "rgba(255,120,110,0.9)", 4, 2);
        break;
      case "heart":
        playGameSound(RUN_SOUNDS.heart);
        burst(effects, PLAYER_X, feet - 20, 10, "rgba(255,90,110,0.9)", 4, 2.5);
        effects.popups.push({ text: "+1 하트", x: PLAYER_X, y: feet - 40, big: false, age: 0 });
        break;
      case "bonusEnd":
        break;
      case "hurt":
        playGameSound(RUN_SOUNDS.hurt);
        playGameSound(GAME_SOUNDS.ouch);
        effects.shake = 5;
        effects.flash = 1;
        break;
      case "fall":
        playGameSound(RUN_SOUNDS.fall);
        effects.flash = 1;
        break;
      case "over":
        playGameSound(RUN_SOUNDS.over);
        break;
      case "points":
        if (event.points > 10) playGameSound(RUN_SOUNDS.pass);
        effects.popups.push({ text: event.points > 10 ? `+${event.points} ${event.label}!` : `+${event.points}`, x: -1, y: -1, big: event.points > 10, age: 0 });
        break;
    }
  }
  // 숙여 미끄러지는 동안 흙먼지
  if (state.player.mode === "slide" && state.frame % 3 === 0) burst(effects, PLAYER_X - 22, GROUND - 2, 2, DUST, 2, 1);
  for (const particle of effects.particles) {
    // 땅 근처 먼지는 세상과 함께 뒤로 흘러간다
    particle.x += particle.vx - (particle.y > GROUND - 30 ? state.speed * 0.25 : 0);
    particle.y += particle.vy;
    particle.vy += 0.12;
    particle.life -= 1;
  }
  effects.particles = effects.particles.filter((particle) => particle.life > 0).slice(-160);
  for (const popup of effects.popups) popup.age += 1;
  // 코인 알림은 짧게, 점수판 밑 알림은 최근 3개까지
  const coinPopups = effects.popups.filter((popup) => popup.x !== -1 && popup.age < POPUP_FRAMES / 1.5);
  const scorePopups = effects.popups.filter((popup) => popup.x === -1 && popup.age < POPUP_FRAMES).slice(-3);
  effects.popups = [...coinPopups, ...scorePopups];
  if (effects.banner) effects.banner = effects.banner.age + 1 < BANNER_FRAMES ? { ...effects.banner, age: effects.banner.age + 1 } : null;
  effects.shake = Math.max(0, effects.shake - 0.4);
  effects.flash = Math.max(0, effects.flash - 0.04);
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
  const effects = useRef<Effects>(emptyEffects());
  const input = useRef<RunInput>({ jump: false, down: false });
  const downKeys = useRef(new Set<string>());
  const downPointers = useRef(new Set<number>());
  const images = useRef<Images>({});

  useLockPageScroll(phase === "countdown" || phase === "playing");

  useEffect(() => {
    images.current = Object.fromEntries(
      IMAGE_NAMES.map((name) => {
        const image = new Image();
        image.src = `${IMAGE_BASE}/${name}.webp`;
        return [name, image];
      }),
    );
  }, []);

  function syncDown() {
    input.current.down = downKeys.current.size > 0 || downPointers.current.size > 0;
  }

  function startCountdown() {
    playGameSound(GAME_SOUNDS.start);
    game.current = createRun();
    effects.current = emptyEffects();
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
    react(effects.current, events, state);
    if (state.over) finish(state);
  });

  // 캔버스를 화면 크기 × 기기 해상도로 맞춘다 (흐릿하게 늘어나지 않게)
  const render = useEffectEvent(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const { clientWidth, clientHeight } = element;
    if (!clientWidth || !clientHeight) return;
    const width = Math.round(clientWidth * dpr);
    const height = Math.round(clientHeight * dpr);
    if (element.width !== width || element.height !== height) {
      element.width = width;
      element.height = height;
    }
    draw(context, viewFor(clientWidth, clientHeight, dpr), game.current, effects.current, images.current);
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
        <canvas ref={canvas} aria-label="카피바라 런 달리기 길" className="absolute inset-0 size-full" />
      )}
      {phase === "playing" && (
        // 터치 화면에서만 보이는 조작 안내 (누르는 건 화면 왼쪽·오른쪽 절반 전체)
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] hidden justify-between px-5 text-caption-1 font-bold text-white/80 [@media(pointer:coarse)]:flex">
          <span className="rounded-full bg-black/25 px-4 py-2 backdrop-blur-sm">◀ 탭: 점프 · 두 번: 2단</span>
          <span className="rounded-full bg-black/25 px-4 py-2 backdrop-blur-sm">누르고 있기: 숙이기 ▶</span>
        </div>
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
