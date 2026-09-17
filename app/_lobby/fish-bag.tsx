"use client";

import { Backpack } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Progress } from "@/components/feedback/progress";
import { cn } from "@/lib";
import { FISH_CATCHES, FOOD_SATIETY, SATIETY_MAX } from "@/lib/lobby/constants";
import { currentSatiety, type Satiety } from "@/lib/lobby/feeding";
import { type FishCatch, fishCatchSrc, type FishInventory } from "@/lib/lobby/fishing";

import { FISH_BAG_SRC, LOBBY_SIDE_PANEL } from "./constants";
import { useLobbyMenuPanel } from "./lobby-menu";
import { flashButton, isShortcutKey, trapDialogFocus } from "./shortcut";

/** 오른쪽 위 카피바라 백팩 버튼. 누르면 그 자리에서 커지며 지금까지 낚은 것들과 포만감이 보이고, 낚은 걸 누르면 카피바라에게 먹인다 (옷장과 같은 방식) */
export function FishBag({
  inventory,
  satiety,
  onFeed,
}: {
  inventory: FishInventory;
  satiety: Satiety;
  onFeed: (name: FishCatch) => void;
}) {
  const { open, panelHost, setOpen } = useLobbyMenuPanel("fish");
  // 포만감은 시간이 지나면 떨어져서, 열려 있는 동안 가끔 다시 읽는다
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, [open]);
  const fullness = Math.round(currentSatiety(satiety, now));
  const full = fullness >= SATIETY_MAX;
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const kinds = FISH_CATCHES.filter((name) => inventory[name]).length;
  const total = FISH_CATCHES.reduce((sum, name) => sum + (inventory[name] ?? 0), 0);

  const close = () => {
    setOpen(false);
    openButtonRef.current?.focus();
  };

  // I: 낚시 가방 열고 닫기
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!isShortcutKey(event, "KeyI")) return;
    event.preventDefault();
    flashButton(openButtonRef.current);
    if (open) close();
    else setOpen(true);
  });
  useEffect(() => {
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  return (
    <div className="relative flex justify-end">
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`낚시 가방 (${total}번 낚음)`}
        aria-expanded={open}
        aria-keyshortcuts="I"
        // 크기는 옷장·앉기·때리기 버튼(모바일 size-14, md 이상 size-18)과 같게
        className="group relative block size-14 rounded-full focus-visible:outline-2 focus-visible:outline-primary md:size-18"
      >
        {/* 누르면 그림과 아이콘이 같이 줄어들게 감싼 쪽에 scale을 준다 */}
        <span className="relative block size-full transition-transform duration-100 motion-safe:group-active:scale-90">
          <NextImage src={FISH_BAG_SRC} alt="" width={256} height={256} unoptimized draggable={false} className="size-full drop-shadow-md" />
          {/* 마우스를 올리거나 키보드 포커스면 나무 테 안쪽 판 위에 가방 아이콘 (앉기·때리기와 같은 방식) */}
          <span
            aria-hidden
            className="absolute inset-[16%] flex items-center justify-center rounded-full bg-overlay text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 group-data-flash:opacity-100 motion-reduce:transition-none"
          >
            <Backpack className="size-6 md:size-7" />
          </span>
        </span>
        {total > 0 && (
          <span
            aria-hidden
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 text-caption-3 font-bold tabular-nums text-primary-foreground"
          >
            {total}
          </span>
        )}
      </button>

      {open && panelHost && createPortal(<section
        role="region"
        aria-label="낚시 가방"
        inert={!open}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            close();
            return;
          }
          trapDialogFocus(event, event.currentTarget);
        }}
        className={cn(LOBBY_SIDE_PANEL, "flex w-full flex-col gap-3 border-t border-border-default pt-4")}
      >
        <div className="flex items-center gap-2">
          <NextImage src={FISH_BAG_SRC} alt="" width={96} height={96} unoptimized className="size-10" />
          <h2 className="flex-1 text-title-3 font-bold text-text-strong">낚시 가방</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-caption-1 font-semibold text-text-strong">포만감</span>
          <Progress value={fullness} aria-label="카피바라 포만감" className="h-2 flex-1" />
          <span className="w-10 shrink-0 text-right text-caption-1 tabular-nums text-text-caption">{fullness}%</span>
        </div>
        <p className="text-caption-1 text-text-caption" aria-live="polite">
          {full && total > 0
            ? "배가 불러 지금은 더 먹을 수 없어요"
            : total > 0
            ? `${FISH_CATCHES.length}종 중 ${kinds}종 · 사과를 눌러 카피바라에게 먹여 보세요`
            : "아직 가방이 비었어요. 물가에서 낚시하거나 사과나무 밑에서 사과를 따 보세요"}
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
              </>
            );
            const cell = "flex w-full min-w-0 flex-col items-center gap-0.5 rounded-xl bg-muted p-2";
            return (
              <li key={name} className="min-w-0">
                {/* 먹을 수 있는 것(사과)만 누를 수 있다. 물고기·장화는 모아 보기만 한다 */}
                {count > 0 && FOOD_SATIETY[name] > 0 ? (
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
      </section>, panelHost)}
    </div>
  );
}
