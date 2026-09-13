"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { Button } from "@/components/inputs/button";
import { Card } from "@/components/display/card";

export const CLICK_SPEED_DURATION_MS = 5000;
const BEST_CPS_KEY = "tabply-click-speed-best-cps";

type Phase = "ready" | "playing" | "result";

function formatCps(count: number) {
  return (count / (CLICK_SPEED_DURATION_MS / 1000)).toFixed(2);
}

export function ClickSpeed() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [count, setCount] = useState(0);
  const [remainingMs, setRemainingMs] = useState(CLICK_SPEED_DURATION_MS);
  const [bestCps, setBestCps] = useState<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const countRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(BEST_CPS_KEY);
    const parsed = stored === null ? Number.NaN : Number(stored);
    if (Number.isFinite(parsed)) setBestCps(parsed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRemainingMs(0);
    setPhase("result");

    const cps = Number(formatCps(countRef.current));
    setBestCps((previous) => {
      if (previous !== null && previous >= cps) return previous;
      window.localStorage.setItem(BEST_CPS_KEY, String(cps));
      return cps;
    });
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const startedAt = performance.now();
    startedAtRef.current = startedAt;
    countRef.current = 0;
    setCount(0);
    setRemainingMs(CLICK_SPEED_DURATION_MS);
    setPhase("playing");

    timerRef.current = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= CLICK_SPEED_DURATION_MS) {
        finish();
        return;
      }
      setRemainingMs(CLICK_SPEED_DURATION_MS - elapsed);
    }, 50);
  }, [finish]);

  const handleTap = useCallback(() => {
    if (phase !== "playing" || startedAtRef.current === null) return;
    if (performance.now() - startedAtRef.current >= CLICK_SPEED_DURATION_MS) {
      finish();
      return;
    }
    countRef.current += 1;
    setCount(countRef.current);
  }, [finish, phase]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleTap();
      }
    },
    [handleTap],
  );

  const seconds = (remainingMs / 1000).toFixed(1);
  const currentCps = formatCps(count);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-8 sm:px-6">
      <div className="mb-6 text-center">
        <p className="mb-2 text-caption-2 font-medium tracking-[0.16em] text-primary uppercase">
          Tabply speed game
        </p>
        <h1 className="text-title-1 font-bold text-text-strong sm:text-3xl">
          클릭 스피드 테스트
        </h1>
        <p className="mt-2 text-caption-1 text-text-caption">
          5초 동안 버튼을 최대한 빠르게 탭하세요.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-border-default border-b border-border-default bg-bg-alternative">
          <div className="px-3 py-4 text-center sm:px-6">
            <span className="block text-caption-3 text-text-caption">남은 시간</span>
            <strong className="mt-1 block font-mono text-xl tabular-nums text-text-strong" data-testid="remaining-time">
              {seconds}s
            </strong>
          </div>
          <div className="px-3 py-4 text-center sm:px-6">
            <span className="block text-caption-3 text-text-caption">클릭 수</span>
            <strong className="mt-1 block font-mono text-xl tabular-nums text-text-strong" data-testid="click-count">
              {count}
            </strong>
          </div>
          <div className="px-3 py-4 text-center sm:px-6">
            <span className="block text-caption-3 text-text-caption">현재 CPS</span>
            <strong className="mt-1 block font-mono text-xl tabular-nums text-text-strong" data-testid="current-cps">
              {currentCps}
            </strong>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {phase === "ready" && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border-default bg-background px-6 text-center sm:min-h-72">
              <p className="text-title-3 font-semibold text-text-strong">준비됐나요?</p>
              <p className="mt-2 max-w-xs text-caption-1 text-text-caption">
                시작 버튼을 누른 뒤 바로 연타를 시작하세요.
              </p>
              <Button type="button" size="xl" className="mt-6 min-h-12 min-w-40" onClick={start}>
                게임 시작
              </Button>
            </div>
          )}

          {phase === "playing" && (
            <button
              type="button"
              data-testid="tap-area"
              aria-label="클릭 스피드 게임 영역"
              onPointerDown={(event) => {
                event.preventDefault();
                handleTap();
              }}
              onKeyDown={handleKeyDown}
              className="flex min-h-64 w-full touch-manipulation select-none items-center justify-center rounded-lg bg-primary px-6 text-center text-title-2 font-bold text-primary-foreground shadow-sm transition-[background-color,box-shadow,transform] hover:bg-primary-hover active:scale-[0.99] focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/50 sm:min-h-72"
            >
              탭!
            </button>
          )}

          {phase === "result" && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-lg bg-bg-alternative px-6 text-center sm:min-h-72">
              <p className="text-caption-1 text-text-caption">최종 CPS</p>
              <p className="mt-1 font-mono text-5xl font-bold tabular-nums text-primary" data-testid="result-cps">
                {currentCps}
              </p>
              <p className="mt-2 text-caption-1 text-text-normal">총 {count}회 클릭</p>
              <Button type="button" size="xl" className="mt-6 min-h-12 min-w-40" onClick={start}>
                다시 도전
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className="mt-5 flex items-center justify-between px-1 text-caption-1">
        <span className="text-text-caption">최고 CPS</span>
        <strong className="font-mono tabular-nums text-text-strong" data-testid="best-cps">
          {bestCps === null ? "-" : bestCps.toFixed(2)}
        </strong>
      </div>

      {phase === "result" && (
        <div className="mt-6">
          <AdSlot placement="click-speed-result" />
        </div>
      )}
    </main>
  );
}

export default ClickSpeed;
