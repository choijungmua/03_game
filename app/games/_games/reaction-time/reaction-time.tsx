"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";

export const REACTION_DELAY_RANGE = { min: 1000, max: 4000 } as const;

type Phase = "idle" | "waiting" | "too-soon" | "go" | "result";

export function ReactionTime() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [bestMs, setBestMs] = useState<number | null>(null);
  const goStartRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const startWaiting = useCallback(() => {
    setPhase("waiting");
    const { min, max } = REACTION_DELAY_RANGE;
    const delay = min + Math.random() * (max - min);
    timeoutRef.current = setTimeout(() => {
      goStartRef.current = Date.now();
      setPhase("go");
    }, delay);
  }, []);

  const handleClick = useCallback(() => {
    if (phase === "idle" || phase === "too-soon" || phase === "result") {
      startWaiting();
      return;
    }

    if (phase === "waiting") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPhase("too-soon");
      return;
    }

    // phase === "go"
    const elapsed = Date.now() - goStartRef.current;
    setReactionMs(elapsed);
    setBestMs((prev) => (prev === null || elapsed < prev ? elapsed : prev));
    setPhase("result");
  }, [phase, startWaiting]);

  const message =
    phase === "idle"
      ? "클릭해서 시작하세요"
      : phase === "waiting"
        ? "기다리세요..."
        : phase === "too-soon"
          ? "너무 빨랐어요! 다시 클릭해서 재시도"
          : phase === "go"
            ? "지금 클릭!"
            : `${reactionMs}ms — 다시 클릭해서 재도전`;

  const bgClass =
    phase === "go"
      ? "bg-success"
      : phase === "too-soon"
        ? "bg-destructive"
        : "bg-primary";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-5 py-12">
      <h1 className="text-title-1 font-semibold text-text-strong">반응속도 테스트</h1>

      <button
        type="button"
        data-testid="reaction-area"
        onClick={handleClick}
        className={`flex h-64 w-full items-center justify-center rounded-2xl px-6 text-center text-title-3 font-semibold text-white transition-colors ${bgClass}`}
      >
        {message}
      </button>

      <p className="text-caption-1 text-text-caption">
        최고 기록:{" "}
        <span data-testid="best-score" className="font-semibold text-text-strong">
          {bestMs === null ? "-" : `${bestMs}ms`}
        </span>
      </p>

      {phase === "result" && (
        <div className="mt-4 w-full">
          <AdSlot placement="reaction-time-result" />
        </div>
      )}
    </main>
  );
}

export default ReactionTime;
