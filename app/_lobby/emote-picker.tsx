"use client";

import NextImage from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { CAPYBARA_EMOTES, emoteImage } from "@/lib/games/emotes";

import { EMOTE_PICKER_ICON, EMOTES_PER_PAGE } from "./constants";
import { isShortcutKey } from "./shortcut";

/** 채팅 알약 오른쪽 끝의 카피바라 이모티콘 버튼. 고르면 바로 내 머리 위 말풍선으로 보낸다 */
export function EmotePicker({ onPick }: { onPick: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const firstEmoteRef = useRef<HTMLButtonElement>(null);
  /** 키보드로 열었으면 첫 이모티콘에 포커스를 줘서 Tab·Enter로 바로 고르게 한다 (마우스로 열 땐 포커스를 옮기지 않는다) */
  const focusFirstRef = useRef(false);

  // ,(쉼표): 이모티콘 창 열고 닫기. 채팅 입력 중엔 쉼표가 글자로 들어간다
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!isShortcutKey(event, "Comma")) return;
    event.preventDefault();
    if (open) {
      setOpen(false);
      return;
    }
    focusFirstRef.current = true;
    setOpen(true);
  });
  useEffect(() => {
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (!open || !focusFirstRef.current) return;
    focusFirstRef.current = false;
    firstEmoteRef.current?.focus();
  }, [open]);

  return (
    <div ref={rootRef} className="shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="카피바라 이모티콘"
        aria-expanded={open}
        aria-keyshortcuts=","
        className="flex size-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary"
      >
        <NextImage src={emoteImage(EMOTE_PICKER_ICON)} alt="" width={56} height={56} unoptimized draggable={false} className="size-7" />
      </button>
      {/* 화면 위쪽을 크게 덮는 창. 한 쪽에 8개(4×2)씩, 세로로 넘기면 다음 8개에 딱 맞춰 멈춘다. 고르거나 바깥을 누르면 닫힌다 */}
      {open && (
        <div
          role="group"
          aria-label="카피바라 이모티콘 고르기"
          className="fixed right-[max(0.75rem,env(safe-area-inset-right))] left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-20 mx-auto aspect-2/1 max-h-[45dvh] max-w-3xl snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth rounded-2xl bg-card/95 shadow-lg backdrop-blur animate-in fade-in slide-in-from-top-4 duration-200 motion-reduce:animate-none motion-reduce:scroll-auto"
        >
          {Array.from({ length: Math.ceil(CAPYBARA_EMOTES.length / EMOTES_PER_PAGE) }, (_, page) => (
            <div key={page} className="grid h-full snap-start snap-always grid-cols-4 grid-rows-2 gap-2 p-2">
              {CAPYBARA_EMOTES.slice(page * EMOTES_PER_PAGE, (page + 1) * EMOTES_PER_PAGE).map((text, index) => {
                const id = page * EMOTES_PER_PAGE + index;
                return (
                  <button
                    key={id}
                    ref={id === 0 ? firstEmoteRef : undefined}
                    type="button"
                    aria-label={text}
                    title={text}
                    onClick={() => {
                      onPick(id);
                      setOpen(false);
                    }}
                    className="flex min-h-0 items-center justify-center rounded-xl p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <NextImage src={emoteImage(id)} alt="" width={96} height={96} unoptimized draggable={false} className="size-full object-contain" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
