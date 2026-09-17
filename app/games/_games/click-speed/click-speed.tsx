"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { GameControls } from "@/components/games/game-controls";
import { GameOverActions } from "@/components/games/game-over-actions";
import { ShareButton } from "@/components/games/share-button";
import { cn } from "@/lib";
import { FULL_BLEED_LAYER, GAME_SOUNDS, GAME_TITLES } from "@/lib/games/constants";
import { submitGameRecord } from "@/lib/games/game-events";
import { useFrameText } from "@/lib/games/use-frame-text";
import { useInView } from "@/lib/games/use-in-view";
import { useLockPageScroll } from "@/lib/games/use-lock-page-scroll";
import { playGameSound, type SoundLayer } from "@/lib/lobby/settings";

import { CLICK_SPEED_SOUNDS, FAIL_TIER_INDEX, RESULT_SOUND_DELAY_MS, RESULT_TAP_GUARD_MS } from "./constants";
import { ClickSpeedLeaderboard } from "./leaderboard";
import {
  calculateCps,
  type ClickSpeedSeconds,
  DEFAULT_SECONDS,
  DURATION_OPTIONS,
  getRank,
  insertRecord,
  saveRecords,
  useClickSpeedRecords,
} from "./records";
import { CLICK_SPEED_TIERS, getClickSpeedTier } from "./tiers";

export const COUNTDOWN_VALUES = [3, 2, 1] as const;
export const COUNTDOWN_STEP_MS = 800;

type Phase = "idle" | "countdown" | "playing" | "result";

interface RoundResult {
  count: number;
  cps: number;
  seconds: ClickSpeedSeconds;
  recordId: string | null;
  /** 한 번도 탭하지 않아 기록이 없으면 null */
  rank: number | null;
}

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function playTap() {
  playGameSound(GAME_SOUNDS.tap);
}

/** 앞 소리가 끝난 뒤 이어서 나도록 모든 층을 ms만큼 미룬다 */
function delayLayers(layers: readonly SoundLayer[], ms: number): SoundLayer[] {
  return layers.map((layer) => ({ ...layer, at: (layer.at ?? 0) + ms }));
}

/** 오른쪽 아래 남은 시간 */
function PlayTimer({ startAt, seconds }: { startAt: number; seconds: number }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const remaining = (elapsedMs: number) => (Math.max(0, seconds * 1000 - elapsedMs) / 1000).toFixed(2);
  useFrameText(valueRef, () => remaining(Date.now() - startAt));

  return (
    <p
      data-testid="play-timer"
      className="pointer-events-none absolute right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] rounded-full bg-black/15 px-3 py-1.5 text-title-3 font-bold tabular-nums"
    >
      <span ref={valueRef}>{remaining(0)}</span>초
    </p>
  );
}

function DurationPicker({
  value,
  onChange,
  className,
}: {
  value: ClickSpeedSeconds;
  onChange: (seconds: ClickSpeedSeconds) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="연타 시간 선택"
      className={cn("flex cursor-default gap-1 rounded-full p-1", className)}
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
    >
      {DURATION_OPTIONS.map((seconds) => (
        <button
          key={seconds}
          type="button"
          aria-pressed={value === seconds}
          onClick={() => {
            playTap();
            onChange(seconds);
          }}
          className={cn(
            "min-h-11 min-w-14 cursor-pointer rounded-full px-4 text-caption-1 font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            value === seconds ? "bg-primary text-white" : "opacity-70 hover:opacity-100",
          )}
        >
          {seconds}초
        </button>
      ))}
    </div>
  );
}

export function ClickSpeed() {
  const records = useClickSpeedRecords();
  const [seconds, setSeconds] = useState<ClickSpeedSeconds>(DEFAULT_SECONDS);
  const [phase, setPhase] = useState<Phase>("idle");
  // 게임 아래 소개 섹션 때문에 페이지가 길다 — 연타 중 손가락이 조금 끌리거나 휠·키를 써도 화면이 밀리지 않게 막는다
  const locked = phase === "countdown" || phase === "playing";
  useLockPageScroll(locked);
  const [countdownIndex, setCountdownIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [playStartAt, setPlayStartAt] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  /** 탭 물결을 붙이는 층. 플레이가 끝나 층이 사라지면 남은 물결도 같이 사라진다 */
  const rippleLayerRef = useRef<HTMLDivElement>(null);
  /** 결과 화면이 뜬 시각. 연타하던 손이 바로 다시 시작하지 않도록 잠깐 탭을 무시하는 기준 */
  const resultAtRef = useRef(0);
  const { ref: recordsRef, inView: recordsVisible } = useInView<HTMLElement>(phase === "result");

  const secondsRecords = records.filter((record) => record.seconds === seconds);

  useEffect(() => {
    if (phase !== "countdown") return;

    const timers = COUNTDOWN_VALUES.map((_, index) =>
      setTimeout(() => {
        if (index < COUNTDOWN_VALUES.length - 1) {
          playGameSound(GAME_SOUNDS.countdown);
          setCountdownIndex(index + 1);
          return;
        }
        playGameSound(GAME_SOUNDS.go);
        setCount(0);
        setPlayStartAt(Date.now());
        setPhase("playing");
      }, COUNTDOWN_STEP_MS * (index + 1)),
    );

    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const finishRound = useEffectEvent(() => {
    resultAtRef.current = Date.now();
    setPhase("result");

    if (count === 0) {
      playGameSound([...CLICK_SPEED_SOUNDS.timeUp, ...delayLayers(GAME_SOUNDS.fail, RESULT_SOUND_DELAY_MS)]);
      setResult({ count: 0, cps: 0, seconds, recordId: null, rank: null });
      return;
    }

    const now = Date.now();
    const record = { id: String(now), count, cps: calculateCps(count, seconds), seconds, at: now };
    const rank = getRank(records, record);

    // 시간 끝 → 등급에 따라 성공/실패 → 1위면 반짝반짝까지
    const failed = CLICK_SPEED_TIERS.indexOf(getClickSpeedTier(record.cps)) >= FAIL_TIER_INDEX;
    const resultSound = failed ? GAME_SOUNDS.fail : GAME_SOUNDS.success;
    playGameSound([
      ...CLICK_SPEED_SOUNDS.timeUp,
      ...delayLayers(resultSound, RESULT_SOUND_DELAY_MS),
      ...(rank === 1 && !failed ? delayLayers(GAME_SOUNDS.record, RESULT_SOUND_DELAY_MS + 700) : []),
    ]);
    saveRecords(insertRecord(records, record));
    void submitGameRecord("click-speed", record.count, record);

    setResult({ count, cps: record.cps, seconds, recordId: record.id, rank });
  });

  // 초록 화면이 된 순간부터 정한 시간이 지나면 끝난다
  useEffect(() => {
    if (phase !== "playing") return;
    const timers = [setTimeout(finishRound, seconds * 1000)];
    // 끝나기 3·2·1초 전마다 삐 — 시간이 거의 다 됐다는 신호
    for (const left of COUNTDOWN_VALUES) {
      if (left < seconds) timers.push(setTimeout(() => playGameSound(GAME_SOUNDS.countdown), (seconds - left) * 1000));
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, seconds]);

  function startCountdown() {
    playGameSound(GAME_SOUNDS.countdown);
    setCountdownIndex(0);
    setPhase("countdown");
  }

  function cancelRound() {
    playGameSound(GAME_SOUNDS.pause);
    setCount(0);
    setPhase("idle");
  }

  function registerTap(x: number, y: number) {
    playGameSound(CLICK_SPEED_SOUNDS.click);
    setCount((prev) => prev + 1);
    // 물결은 상태로 두지 않고 DOM에 바로 붙였다가 애니메이션이 끝나면 뗀다 (탭마다 렌더를 한 번 더 하지 않게)
    const layer = rippleLayerRef.current;
    if (!layer) return;
    const ripple = document.createElement("span");
    ripple.dataset.testid = "ripple";
    ripple.className = "pointer-events-none absolute size-6 rounded-full bg-white animate-click-ripple";
    ripple.style.left = `${x - 12}px`;
    ripple.style.top = `${y - 12}px`;
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    layer.append(ripple);
  }

  // 연타는 손가락이 닿는 순간(pointerdown)에 센다
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (phase !== "playing") return;
    const rect = containerRef.current?.getBoundingClientRect();
    registerTap(event.clientX - (rect?.left ?? 0), event.clientY - (rect?.top ?? 0));
  }

  /** 시작 화면이거나, 결과 화면이 뜨고 연타 여운이 지나갔으면 새 판을 연다 */
  function canStart() {
    if (phase === "idle") return true;
    return phase === "result" && Date.now() - resultAtRef.current >= RESULT_TAP_GUARD_MS;
  }

  // 시작/재시작은 click으로 받아 스크롤하려고 끄는 동작에는 반응하지 않게 한다
  function handleClick() {
    if (canStart()) startCountdown();
  }

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (event.repeat) return;
    if (event.target instanceof HTMLElement && event.target.closest("a, button, input, textarea, select")) {
      return;
    }

    event.preventDefault();
    if (phase === "playing") {
      const rect = containerRef.current?.getBoundingClientRect();
      registerTap((rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2);
      return;
    }
    if (canStart()) startCountdown();
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const tier = result ? getClickSpeedTier(result.cps) : null;

  const screenClass =
    phase === "countdown" || phase === "playing"
      ? "bg-success text-neutral-950"
      : phase === "result" && tier
        ? recordsVisible
          ? "bg-background text-foreground"
          : cn(tier.bgClass, tier.fgClass)
        : "bg-background text-foreground";

  const rankLabel = result && result.rank !== null ? `${result.rank}위` : "탭한 기록이 없어요";

  const shareText =
    phase === "result" && result && tier
      ? `클릭 스피드 테스트 ${result.seconds}초 동안 ${result.count}회(초당 ${result.cps.toFixed(1)}회)로 ${tier.label} 등급이 나왔어요. 나보다 빠를 수 있나요?`
      : "초록 화면을 최대한 빠르게 연타하는 클릭 스피드 테스트, 같이 해 봐요";

  const liveMessage =
    phase === "countdown"
      ? `${COUNTDOWN_VALUES[countdownIndex]}`
      : phase === "playing"
        ? `${seconds}초 동안 연타하세요`
        : phase === "result" && result && tier
          ? `${rankLabel}, ${result.seconds}초 동안 ${result.count}회, 초당 ${result.cps.toFixed(1)}회, ${tier.label} 등급`
          : "";

  return (
    <div
      ref={containerRef}
      data-testid="click-speed-screen"
      data-hide-page-scrollbar="true"
      data-phase={phase}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className={cn(
        // isolate: 배경 층(-z-10)이 루트 안에서만 뒤로 가서, 아래 소개 섹션보다는 위에 그려진다
        "relative isolate flex min-h-dvh w-full cursor-pointer select-none flex-col items-center justify-center overflow-hidden px-5 py-10 transition-colors [-webkit-tap-highlight-color:transparent]",
        // 플레이 중에는 끌기·두 손가락 확대·당겨서 새로고침까지 브라우저 제스처를 모두 끈다 (시작·결과 화면은 스크롤해야 한다)
        locked ? "touch-none" : "touch-manipulation",
        phase === "result" ? "duration-700" : "duration-200",
        screenClass,
      )}
    >
      {/* 플레이 중엔 페이지가 맨 위에 고정된다 — 사파리 툴바·홈 인디케이터 뒤(아래 소개 섹션 자리)까지 같은 색으로 덮는다.
          시작·결과 화면은 소개를 읽으러 스크롤해야 하니 깔지 않는다 (고정 층이 소개를 가린다) */}
      {locked && <div aria-hidden="true" className={cn(FULL_BLEED_LAYER, "-z-10", screenClass)} />}
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {phase === "idle" && (
        <ShareButton
          className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]"
          title={GAME_TITLES["click-speed"]}
          text={shareText}
        />
      )}

      <GameControls onCancelRound={phase === "countdown" || phase === "playing" ? cancelRound : undefined} />

      {phase === "idle" && (
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <header className="space-y-2">
            {/* 좌우 여백: 좁은 폰에서 제목이 오른쪽 위 공유 버튼 밑으로 들어가지 않게 */}
            <h1 className="px-12 text-title-1 font-bold text-text-strong">{GAME_TITLES["click-speed"]}</h1>
            <p className="text-caption-1 text-balance text-text-caption">
              화면을 누르면 3·2·1 카운트다운이 시작돼요. 초록 화면이 되면 정한 시간 동안 최대한 빠르게 연타하세요.
            </p>
          </header>

          <DurationPicker value={seconds} onChange={setSeconds} className="bg-card text-text-strong" />

          <p className="text-title-1 font-bold text-text-strong">클릭해서 시작하세요</p>

          <ClickSpeedLeaderboard records={secondsRecords} />
        </div>
      )}

      {phase !== "idle" && <h1 className="sr-only">{GAME_TITLES["click-speed"]}</h1>}

      {phase === "countdown" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            key={countdownIndex}
            data-testid="countdown"
            className="animate-in fade-in zoom-in-50 animation-duration-300 text-[11rem] font-black leading-none tabular-nums sm:text-[15rem]"
          >
            {COUNTDOWN_VALUES[countdownIndex]}
          </span>
          <p className="text-title-3 font-semibold opacity-80">
            초록 화면이 되면 {seconds}초 동안 최대한 빠르게 연타하세요
          </p>
        </div>
      )}

      {phase === "playing" && (
        <>
          <span
            data-testid="count"
            className="pointer-events-none whitespace-nowrap text-[9rem] font-black leading-none tabular-nums sm:text-[13rem]"
          >
            {count}
          </span>

          <div ref={rippleLayerRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />

          <PlayTimer startAt={playStartAt} seconds={seconds} />
        </>
      )}

      {phase === "result" && result && tier && (
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <section
            data-testid="result-hero"
            className="flex min-h-[calc(100dvh-5rem)] w-full flex-col items-center justify-center gap-6"
          >
            <div className="flex flex-col items-center gap-3">
              <p data-testid="result-tier" className="rounded-full bg-black/15 px-4 py-1 text-caption-1 font-bold">
                {tier.label}
              </p>
              <p data-testid="result-seconds" className="text-title-3 font-semibold tabular-nums">
                {result.seconds}초 동안
              </p>
              <p className="flex items-baseline gap-2 font-black tabular-nums">
                <span data-testid="result-count" className="text-[6.5rem] leading-none sm:text-[8rem]">
                  {result.count}
                </span>
                <span className="text-title-1">회</span>
              </p>
              <p data-testid="result-rank" className="text-title-2 font-bold tabular-nums">
                {rankLabel}
              </p>
            </div>

            <p data-testid="result-summary" className="text-title-3 font-semibold text-balance">
              {tier.label} <span data-testid="result-cps">초당 {result.cps.toFixed(1)}회</span>, {tier.description}
            </p>

            <div
              className="flex cursor-default items-center gap-3 rounded-full bg-black/10 py-1.5 pr-1.5 pl-5"
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
            >
              <p className="text-caption-1 font-semibold">이 기록을 친구에게 공유할까요?</p>
              <ShareButton title={GAME_TITLES["click-speed"]} text={shareText} />
            </div>

            <div className="flex flex-col items-center gap-2">
              <DurationPicker value={seconds} onChange={setSeconds} className="bg-black/10" />
              <GameOverActions onRetry={startCountdown} className="max-w-xs" />
              <p className="flex items-center gap-1 text-caption-2 font-medium opacity-80">
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
            <ClickSpeedLeaderboard records={secondsRecords} highlightId={result.recordId ?? undefined} />
          </section>
        </div>
      )}
    </div>
  );
}

export default ClickSpeed;
