"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib";
import { FEVER_COMBO } from "./constants";
import { comboMultiplierFor, type TimeBonusReason } from "./logic";

type ScoreGain = {
  readonly id: number;
  readonly points: number;
};

type TimeGain = {
  readonly id: number;
  readonly seconds: number;
  readonly reasons: readonly TimeBonusReason[];
};

const TIME_BONUS_REASON_LABEL: Record<TimeBonusReason, string> = {
  combo: "연속 콤보",
  special: "특수 블록",
};

type PangHudProps = {
  readonly timer: ReactNode;
  readonly score: number;
  readonly scoreGain: ScoreGain | null;
  readonly timeGain: TimeGain | null;
  readonly combo: number;
  readonly fever: boolean;
  readonly lastBonus: number;
  /** 바로 위 목표(다음 등급이나 내 최고 기록). 다 넘으면 null */
  readonly goal?: { readonly label: string; readonly score: number } | null;
};

export function PangHud({ timer, score, scoreGain, timeGain, combo, fever, lastBonus, goal }: PangHudProps) {
  const comboMultiplier = comboMultiplierFor(combo);

  return (
    <header className="flex w-full flex-col gap-2" aria-label="게임 진행 상황">
      {timer}

      <div className="flex min-h-14 w-full items-end justify-between gap-4">
        <p className="flex flex-col">
          <span className="text-caption-2 font-semibold opacity-70">점수</span>
          <span className="flex items-baseline gap-2">
            <span data-testid="play-score" className="text-title-1 font-black tabular-nums">
              {score.toLocaleString("ko-KR")}
            </span>
            {scoreGain && (
              <span
                key={scoreGain.id}
                data-testid="score-gain"
                aria-hidden="true"
                className="pointer-events-none text-title-3 font-black text-yellow-300 motion-safe:animate-pang-score motion-reduce:opacity-0"
              >
                +{scoreGain.points.toLocaleString("ko-KR")}
              </span>
            )}
          </span>
          {goal && (
            <span data-testid="play-goal" className="text-caption-2 font-semibold tabular-nums opacity-80">
              {goal.label}까지 {(goal.score - score).toLocaleString("ko-KR")}점
            </span>
          )}
        </p>

        <div className="flex flex-col items-end gap-1">
      {timeGain && (
        <span
          key={timeGain.id}
          data-testid="time-gain"
          aria-live="polite"
          className="rounded-full bg-emerald-300 px-3 py-0.5 text-caption-1 font-black text-neutral-950 motion-safe:animate-pang-combo"
        >
          +{timeGain.seconds}초 · {timeGain.reasons.map((reason) => TIME_BONUS_REASON_LABEL[reason]).join(" · ")}
        </span>
      )}
          {lastBonus > 0 && (
            <span
              key={lastBonus}
              data-testid="last-pang-bonus"
              className="rounded-full bg-orange-400 px-3 py-0.5 text-caption-1 font-black tabular-nums text-neutral-950 motion-safe:animate-pang-combo"
            >
              피날레 +{lastBonus.toLocaleString("ko-KR")}
            </span>
          )}
          {fever && (
            <span
              data-testid="fever"
              className="rounded-full bg-yellow-300 px-3 py-0.5 text-caption-1 font-black text-neutral-950"
            >
              피버 ×2
            </span>
          )}
          <span
            key={combo}
            data-testid="play-combo"
            className={cn(
              "text-title-3 font-bold tabular-nums motion-safe:animate-pang-combo",
              combo >= FEVER_COMBO / 2 && "text-yellow-300",
              combo < 2 && "invisible",
            )}
          >
          {/* 콤보가 끊기기 직전 빨갛게 깜빡 — key={combo}라 새 콤보마다 처음부터 다시 */}
          <span className="motion-safe:animate-pang-warn">
            {combo}콤보 · ×{comboMultiplier.toLocaleString("ko-KR")}
          </span>
        </span>
        </div>
      </div>
    </header>
  );
}
