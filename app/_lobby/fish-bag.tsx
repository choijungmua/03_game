"use client";

import { Heart } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useState } from "react";

import { Progress } from "@/components/feedback/progress";
import { cn } from "@/lib";
import { FISH_CATCHES, FOOD_AFFECTION, FOOD_SATIETY, SATIETY_MAX } from "@/lib/lobby/constants";
import { currentSatiety, type Satiety } from "@/lib/lobby/feeding";
import { type FishCatch, fishCatchSrc, type FishInventory } from "@/lib/lobby/fishing";

import { useLobbyMenuPanel } from "./lobby-menu";

/** 내 카피바라 메뉴의 가방 탭: 포만감·애정도와 지금까지 낚은 것들. 낚은 걸 누르면 카피바라에게 먹인다 */
export function FishBag({
  inventory,
  satiety,
  affection,
  onFeed,
}: {
  inventory: FishInventory;
  satiety: Satiety;
  affection: number;
  onFeed: (name: FishCatch) => void;
}) {
  const { open } = useLobbyMenuPanel("fish");
  // 포만감은 시간이 지나면 떨어져서, 열려 있는 동안 가끔 다시 읽는다
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, [open]);
  const fullness = Math.round(currentSatiety(satiety, now));
  const full = fullness >= SATIETY_MAX;
  const kinds = FISH_CATCHES.filter((name) => inventory[name]).length;
  const total = FISH_CATCHES.reduce((sum, name) => sum + (inventory[name] ?? 0), 0);

  return (
    <section aria-label="낚시 가방" className="flex w-full flex-col gap-3">
      <div className="grid gap-2 rounded-2xl bg-muted/60 p-3">
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-caption-1 font-semibold text-text-strong">포만감</span>
          <Progress value={fullness} aria-label="카피바라 포만감" className="h-2 flex-1" />
          <span className="w-10 shrink-0 text-right text-caption-1 tabular-nums text-text-caption">{fullness}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex w-12 shrink-0 items-center gap-1 text-caption-1 font-semibold text-text-strong">
            <Heart aria-hidden className="size-3.5 fill-primary text-primary" />
            애정
          </span>
          <Progress value={affection} aria-label="카피바라 애정도" className="h-2 flex-1" />
          <span className="w-10 shrink-0 text-right text-caption-1 tabular-nums text-text-caption">{affection}%</span>
        </div>
      </div>
      <p className="text-caption-1 text-text-caption" aria-live="polite">
        {full
          ? "배가 불러 지금은 더 먹을 수 없어요"
          : total > 0
          ? `${FISH_CATCHES.length}종 중 ${kinds}종 · 눌러서 카피바라에게 먹여 보세요`
          : "아직 낚은 게 없어요. 물가에서 Space로 낚시해 보세요"}
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {FISH_CATCHES.map((name) => {
          const count = inventory[name] ?? 0;
          const content = (
            <>
              {/* 아직 못 낚은 건 까만 그림자로만 보여 준다 */}
              <NextImage
                src={fishCatchSrc(name)}
                alt=""
                width={128}
                height={128}
                unoptimized
                className={cn("size-14 object-contain drop-shadow-sm", count === 0 && "opacity-35 brightness-0")}
              />
              <span className="w-full truncate text-center text-caption-2 font-semibold text-text-strong">
                {count > 0 ? (
                  name
                ) : (
                  <>
                    <span aria-hidden>???</span>
                    <span className="sr-only">아직 못 낚은 것</span>
                  </>
                )}
              </span>
              <span className="text-caption-3 tabular-nums text-text-caption">{count > 0 ? `×${count}` : " "}</span>
              {count > 0 && FOOD_SATIETY[name] > 0 && (
                <span className="text-caption-3 tabular-nums text-text-caption">포만 +{FOOD_SATIETY[name]} · 애정 +{FOOD_AFFECTION[name]}</span>
              )}
            </>
          );
          const cell = "flex w-full min-w-0 flex-col items-center gap-0.5 rounded-xl bg-muted p-2";
          return (
            <li key={name} className="min-w-0">
              {count > 0 ? (
                <button
                  type="button"
                  onClick={() => onFeed(name)}
                  disabled={full}
                  aria-label={full ? `${name} 먹이기 불가, 배부름` : `${name} 먹이기 (${count}개)`}
                  className={cn(
                    cell,
                    "transition-transform duration-100 enabled:hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-primary motion-safe:enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-45",
                  )}
                >
                  {content}
                </button>
              ) : (
                <div className={cell}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
