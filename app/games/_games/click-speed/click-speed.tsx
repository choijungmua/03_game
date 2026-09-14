"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { GameControls } from "@/components/games/game-controls";
import { ShareButton } from "@/components/games/share-button";
import { cn } from "@/lib";
import { GAME_TITLES } from "@/lib/games/constants";
import { submitGameRecord } from "@/lib/games/supabase";
import { useInView } from "@/lib/games/use-in-view";

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
import { getClickSpeedTier } from "./tiers";

export const COUNTDOWN_VALUES = [3, 2, 1] as const;
export const COUNTDOWN_STEP_MS = 800;

type Phase = "idle" | "countdown" | "playing" | "result";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

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

/** 오른쪽 아래 남은 시간 */
function PlayTimer({ startAt, seconds }: { startAt: number; seconds: number }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsedMs(Date.now() - startAt), 10);
    return () => clearInterval(id);
  }, [startAt]);

  return (
    <p
      data-testid="play-timer"
      className="pointer-events-none absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] rounded-full bg-black/15 px-3 py-1.5 text-title-3 font-bold tabular-nums"
    >
      {(Math.max(0, seconds * 1000 - elapsedMs) / 1000).toFixed(2)}초
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
          onClick={() => onChange(seconds)}
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
  const [countdownIndex, setCountdownIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [playStartAt, setPlayStartAt] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const rippleIdRef = useRef(0);
  const { ref: recordsRef, inView: recordsVisible } = useInView<HTMLElement>(phase === "result");

  const secondsRecords = records.filter((record) => record.seconds === seconds);

  useEffect(() => {
    if (phase !== "countdown") return;

    const timers = COUNTDOWN_VALUES.map((_, index) =>
      setTimeout(() => {
        if (index < COUNTDOWN_VALUES.length - 1) {
          setCountdownIndex(index + 1);
          return;
        }
        setCount(0);
        setRipples([]);
        setPlayStartAt(Date.now());
        setPhase("playing");
      }, COUNTDOWN_STEP_MS * (index + 1)),
    );

    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const finishRound = useEffectEvent(() => {
    setRipples([]);
    setPhase("result");

    if (count === 0) {
      setResult({ count: 0, cps: 0, seconds, recordId: null, rank: null });
      return;
    }

    const now = Date.now();
    const record = { id: String(now), count, cps: calculateCps(count, seconds), seconds, at: now };
    const rank = getRank(records, record);
    saveRecords(insertRecord(records, record));
    void submitGameRecord("click-speed", record.count, record);

    setResult({ count, cps: record.cps, seconds, recordId: record.id, rank });
  });

  // 초록 화면이 된 순간부터 정한 시간이 지나면 끝난다
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setTimeout(finishRound, seconds * 1000);
    return () => clearTimeout(timer);
  }, [phase, seconds]);

  function startCountdown() {
    setCountdownIndex(0);
    setPhase("countdown");
  }

  function cancelRound() {
    setCount(0);
    setRipples([]);
    setPhase("idle");
  }

  function registerTap(x: number, y: number) {
    const id = rippleIdRef.current++;
    setRipples((prev) => [...prev, { id, x, y }]);
    setCount((prev) => prev + 1);
  }

  // 연타는 손가락이 닿는 순간(pointerdown)에 센다
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (phase !== "playing") return;
    const rect = containerRef.current?.getBoundingClientRect();
    registerTap(event.clientX - (rect?.left ?? 0), event.clientY - (rect?.top ?? 0));
  }

  // 시작/재시작은 click으로 받아 스크롤하려고 끄는 동작에는 반응하지 않게 한다
  function handleClick() {
    if (phase === "idle" || phase === "result") startCountdown();
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
    if (phase === "idle" || phase === "result") startCountdown();
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function removeRipple(id: number) {
    setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
  }

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
      data-phase={phase}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className={cn(
        "relative flex min-h-dvh w-full cursor-pointer touch-manipulation select-none flex-col items-center justify-center overflow-hidden px-5 py-10 transition-colors [-webkit-tap-highlight-color:transparent]",
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
            className="pointer-events-none text-[9rem] font-black leading-none tabular-nums sm:text-[13rem]"
          >
            {count}
          </span>

          {ripples.map((ripple) => (
            <span
              key={ripple.id}
              data-testid="ripple"
              onAnimationEnd={() => removeRipple(ripple.id)}
              className="pointer-events-none absolute size-6 rounded-full bg-white animate-click-ripple"
              style={{ left: ripple.x - 12, top: ripple.y - 12 }}
            />
          ))}

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
              <p className="text-caption-1 font-semibold opacity-80">탭해서 다시 도전</p>
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
            <AdSlot placement="click-speed-result" />
          </section>
        </div>
      )}
    </div>
  );
}

export default ClickSpeed;
