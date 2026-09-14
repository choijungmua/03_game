"use client";

import NextImage from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { CAPYBARA_EMOTES, emoteImage } from "@/lib/games/emotes";

import { EMOTE_PICKER_ICON } from "./constants";
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
    <div ref={rootRef} className="relative shrink-0">
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
      {open && (
        <div
          role="group"
          aria-label="카피바라 이모티콘 고르기"
          className="absolute left-0 top-full mt-2 grid w-72 max-w-[calc(100vw-1.5rem)] grid-cols-4 gap-1 rounded-2xl bg-card/95 p-2 shadow-lg backdrop-blur"
        >
          {CAPYBARA_EMOTES.map((text, id) => (
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
              className="flex aspect-square items-center justify-center rounded-xl p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
            >
              <NextImage src={emoteImage(id)} alt="" width={96} height={96} unoptimized draggable={false} className="size-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
