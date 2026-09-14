"use client";

import { Backpack, Fish } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { cn } from "@/lib";
import { FISH_CATCHES } from "@/lib/lobby/constants";
import type { FishInventory } from "@/lib/lobby/fishing";

import { FRAME_SRC } from "./constants";
import { flashButton, isShortcutKey } from "./shortcut";

/** 오른쪽 위 가방 버튼. 누르면 그 자리에서 커지며 지금까지 낚은 것들이 보인다 (옷장과 같은 방식) */
export function FishBag({ inventory }: { inventory: FishInventory }) {
  const [open, setOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const kinds = FISH_CATCHES.filter((name) => inventory[name]).length;
  const total = FISH_CATCHES.reduce((sum, name) => sum + (inventory[name] ?? 0), 0);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      openButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

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
    // z-[5]: 열린 가방 창이 아래 효과음 버튼 위에, 위 옷장 창(z-10) 아래에 그려지게
    <div className="relative z-[5] flex justify-end">
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`낚시 가방 (${total}번 낚음)`}
        aria-expanded={open}
        aria-keyshortcuts="I"
        // 크기는 옷장·앉기·때리기 버튼(모바일 size-14, md 이상 size-18)과 같게
        className="group relative flex size-14 items-center justify-center rounded-full bg-card/90 text-text-strong shadow-md backdrop-blur hover:text-primary focus-visible:outline-2 focus-visible:outline-primary data-flash:text-primary md:size-18"
      >
        <Backpack className="size-6 md:size-7" aria-hidden />
        <NextImage src={FRAME_SRC} alt="" fill unoptimized sizes="72px" draggable={false} />
        {total > 0 && (
          <span
            aria-hidden
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 text-caption-3 font-bold tabular-nums text-primary-foreground"
          >
            {total}
          </span>
        )}
      </button>

      <section
        role="dialog"
        aria-label="낚시 가방"
        inert={!open}
        className={cn(
          "absolute right-0 top-0 flex max-h-[calc(100dvh-2rem)] w-[min(20rem,calc(100vw-2rem))] origin-top-right flex-col gap-3 overflow-y-auto overscroll-contain rounded-2xl bg-card/95 p-4 shadow-lg backdrop-blur transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-[0.15] opacity-0",
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-title-3 font-bold text-text-strong">낚시 가방</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="닫기"
            className="flex size-10 items-center justify-center rounded-full text-title-3 text-text-caption hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
          >
            ×
          </button>
        </div>
        <p className="text-caption-1 text-text-caption" aria-live="polite">
          {total > 0
            ? `${FISH_CATCHES.length}종 중 ${kinds}종 · 모두 ${total}번 낚았어요`
            : "아직 낚은 게 없어요. 물가에서 Space로 낚시해 보세요"}
        </p>
        <ul className="grid grid-cols-2 gap-2">
          {FISH_CATCHES.map((name) => {
            const count = inventory[name] ?? 0;
            return (
              <li
                key={name}
                className={cn("flex min-w-0 items-center gap-2 rounded-xl border border-border-default p-2", count === 0 && "opacity-50")}
              >
                <Fish className="size-5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-caption-1 font-semibold text-text-strong">
                  {count > 0 ? (
                    name
                  ) : (
                    <>
                      <span aria-hidden>???</span>
                      <span className="sr-only">아직 못 낚은 것</span>
                    </>
                  )}
                </span>
                {count > 0 && <span className="text-caption-1 tabular-nums text-text-caption">×{count}</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
