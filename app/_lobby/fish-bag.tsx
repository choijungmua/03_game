"use client";

import { Backpack } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { cn } from "@/lib";
import { FISH_CATCHES } from "@/lib/lobby/constants";
import { fishCatchSrc, type FishInventory } from "@/lib/lobby/fishing";

import { FISH_BAG_SRC } from "./constants";
import { flashButton, isShortcutKey } from "./shortcut";

/** 오른쪽 위 잎 바구니 버튼. 누르면 그 자리에서 커지며 지금까지 낚은 것들이 보인다 (옷장과 같은 방식) */
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

      <section
        role="dialog"
        aria-label="낚시 가방"
        inert={!open}
        className={cn(
          "absolute right-0 top-0 flex max-h-[calc(100dvh-2rem)] w-[min(20rem,calc(100vw-2rem))] origin-top-right flex-col gap-3 overflow-y-auto overscroll-contain rounded-2xl bg-card/95 p-4 shadow-lg backdrop-blur transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-[0.15] opacity-0",
        )}
      >
        <div className="flex items-center gap-2">
          <NextImage src={FISH_BAG_SRC} alt="" width={96} height={96} unoptimized className="size-10" />
          <h2 className="flex-1 text-title-3 font-bold text-text-strong">낚시 가방</h2>
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
        <ul className="grid grid-cols-3 gap-2">
          {FISH_CATCHES.map((name) => {
            const count = inventory[name] ?? 0;
            return (
              <li key={name} className="flex min-w-0 flex-col items-center gap-0.5 rounded-xl bg-muted p-2">
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
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
