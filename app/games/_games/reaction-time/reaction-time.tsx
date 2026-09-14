"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { GameControls } from "@/components/games/game-controls";
import { ShareButton } from "@/components/games/share-button";
import { cn } from "@/lib";
import { GAME_TITLES } from "@/lib/games/constants";
import { submitGameRecord } from "@/lib/games/supabase";
import { useFrameText } from "@/lib/games/use-frame-text";
import { useInView } from "@/lib/games/use-in-view";

import { ReactionLeaderboard } from "./leaderboard";
import { getRank, insertRecord, saveRecords, useReactionRecords } from "./records";
import { getTier } from "./tiers";

export const COUNTDOWN_VALUES = [3, 2, 1] as const;
export const COUNTDOWN_STEP_MS = 800;

type Phase = "idle" | "countdown" | "too-soon" | "running" | "result";

interface RoundResult {
  ms: number;
  recordId: string;
  rank: number;
}

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function RunningTimer({ startAt }: { startAt: number }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  useFrameText(valueRef, () => String(Date.now() - startAt));

  return (
    <p className="flex items-baseline gap-2 font-black tabular-nums">
      <span ref={valueRef} data-testid="timer" className="text-[8rem] leading-none sm:text-[11rem]">
        0
      </span>
      <span className="text-title-1">ms</span>
    </p>
  );
}

export function ReactionTime() {
  const records = useReactionRecords();
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdownIndex, setCountdownIndex] = useState(0);
  const [startAt, setStartAt] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);
  // 결과를 멈춘 pointerdown 뒤에 따라오는 click이 곧바로 재시작하지 않도록 막는다
  const suppressClickRef = useRef(false);
  const { ref: recordsRef, inView: recordsVisible } = useInView<HTMLElement>(phase === "result");

  useEffect(() => {
    if (phase !== "countdown") return;

    const timers = COUNTDOWN_VALUES.map((_, index) =>
      setTimeout(() => {
        if (index < COUNTDOWN_VALUES.length - 1) {
          setCountdownIndex(index + 1);
          return;
        }
        setStartAt(Date.now());
        setPhase("running");
      }, COUNTDOWN_STEP_MS * (index + 1)),
    );

    return () => timers.forEach(clearTimeout);
  }, [phase]);

  function startCountdown() {
    setCountdownIndex(0);
    setPhase("countdown");
  }

  function finishRound() {
    const now = Date.now();
    const record = { id: String(now), ms: now - startAt, at: now };
    const rank = getRank(records, record);
    saveRecords(insertRecord(records, record));
    void submitGameRecord("reaction-time", record.ms, record);

    setResult({ ms: record.ms, recordId: record.id, rank });
    setPhase("result");
  }

  // 타이밍이 중요한 판정은 손가락이 닿는 순간(pointerdown)에 한다
  function handlePress() {
    suppressClickRef.current = false;

    if (phase === "countdown") {
      setPhase("too-soon");
      suppressClickRef.current = true;
      return;
    }

    if (phase === "running") {
      finishRound();
      suppressClickRef.current = true;
    }
  }

  // 시작/재시작은 click으로 받아 스크롤하려고 끄는 동작에는 반응하지 않게 한다
  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (phase === "idle" || phase === "too-soon" || phase === "result") {
      startCountdown();
    }
  }

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (event.repeat) return;
    if (event.target instanceof HTMLElement && event.target.closest("a, button, input, textarea, select")) {
      return;
    }

    event.preventDefault();
    if (phase === "countdown" || phase === "running") {
      handlePress();
      suppressClickRef.current = false;
      return;
    }
    startCountdown();
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const tier = result ? getTier(result.ms) : null;

  const screenClass =
    phase === "countdown" || phase === "running"
      ? "bg-success text-neutral-950"
      : phase === "too-soon"
        ? "bg-destructive text-neutral-950"
        : phase === "result" && tier
          ? recordsVisible
            ? "bg-background text-foreground"
            : cn(tier.bgClass, tier.fgClass)
          : "bg-background text-foreground";

  const shareText =
    phase === "result" && result && tier
      ? `반응속도 테스트에서 ${result.ms}ms로 ${tier.label} 등급이 나왔어요. 나보다 빠를 수 있나요?`
      : "3·2·1 카운트다운이 끝나는 순간 누르는 반응속도 테스트, 같이 해 봐요";

  const liveMessage =
    phase === "countdown"
      ? `${COUNTDOWN_VALUES[countdownIndex]}`
      : phase === "running"
        ? "지금 누르세요"
        : phase === "too-soon"
          ? "너무 빨랐어요"
          : phase === "result" && result && tier
            ? `${result.rank}위, ${result.ms}ms, ${tier.label} 등급`
            : "";

  return (
    <div
      data-testid="reaction-area"
      data-phase={phase}
      onPointerDown={handlePress}
      onClick={handleClick}
      className={cn(
        "relative flex min-h-dvh w-full cursor-pointer touch-manipulation select-none flex-col items-center justify-center overflow-x-hidden px-5 py-10 transition-colors [-webkit-tap-highlight-color:transparent]",
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
          title={GAME_TITLES["reaction-time"]}
          text={shareText}
        />
      )}

      <GameControls
        onCancelRound={phase === "countdown" || phase === "running" ? () => setPhase("idle") : undefined}
      />

      {phase === "idle" && (
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <header className="space-y-2">
            {/* 좌우 여백: 좁은 폰에서 제목이 오른쪽 위 공유 버튼 밑으로 들어가지 않게 */}
            <h1 className="px-12 text-title-1 font-bold text-text-strong">{GAME_TITLES["reaction-time"]}</h1>
            <p className="text-caption-1 text-balance text-text-caption">
              화면을 누르면 3·2·1 카운트다운이 시작돼요. 숫자가 올라가기 시작하면 바로 누르세요.
            </p>
          </header>

          <p className="text-title-1 font-bold text-text-strong">클릭해서 시작하세요</p>

          <ReactionLeaderboard records={records} />
        </div>
      )}

      {phase !== "idle" && <h1 className="sr-only">{GAME_TITLES["reaction-time"]}</h1>}

      {phase === "countdown" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            key={countdownIndex}
            data-testid="countdown"
            className="animate-in fade-in zoom-in-50 animation-duration-300 text-[11rem] font-black leading-none tabular-nums sm:text-[15rem]"
          >
            {COUNTDOWN_VALUES[countdownIndex]}
          </span>
          <p className="text-title-3 font-semibold opacity-80">숫자가 올라가면 바로 누르세요</p>
        </div>
      )}

      {phase === "running" && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-title-2 font-bold">지금 누르세요!</p>
          <RunningTimer startAt={startAt} />
        </div>
      )}

      {phase === "too-soon" && (
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <p className="text-[3.5rem] font-black leading-tight">너무 빨랐어요!</p>
          <p className="text-title-3 font-semibold">숫자가 올라가기 시작한 뒤에 누르세요</p>
          <p className="mt-4 text-caption-1 font-semibold opacity-80">탭해서 다시 시도</p>
        </div>
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
              <p className="flex items-baseline gap-2 font-black tabular-nums">
                <span data-testid="result-ms" className="text-[6.5rem] leading-none sm:text-[8rem]">
                  {result.ms}
                </span>
                <span className="text-title-1">ms</span>
              </p>
              <p data-testid="result-rank" className="text-title-2 font-bold tabular-nums">
                {result.rank}위
              </p>
            </div>

            <p data-testid="result-summary" className="text-title-3 font-semibold text-balance">
              {tier.label} {result.ms}ms, {tier.description}
            </p>

            <div
              className="flex cursor-default items-center gap-3 rounded-full bg-black/10 py-1.5 pr-1.5 pl-5"
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
            >
              <p className="text-caption-1 font-semibold">이 기록을 친구에게 공유할까요?</p>
              <ShareButton title={GAME_TITLES["reaction-time"]} text={shareText} />
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
            <ReactionLeaderboard records={records} highlightId={result.recordId} />
            <AdSlot placement="reaction-time-result" />
          </section>
        </div>
      )}
    </div>
  );
}

export default ReactionTime;
