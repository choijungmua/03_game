"use client";

import { useEffect, useRef, useState } from "react";

const EMOJIS = ["😊", "😂", "🥹", "😍", "😎", "🤔", "😴", "😭", "😡", "👍", "👏", "🙏", "👋", "🎉", "💖", "🔥", "✨", "💯", "🍊", "🐾", "🎮", "☕", "🌿", "😀"];

/** 채팅 알약 오른쪽 끝의 이모지 버튼. 고른 이모지는 입력창 커서 자리에 들어간다 */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
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

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="이모지"
        aria-expanded={open}
        className="flex size-8 items-center justify-center rounded-full text-base opacity-80 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span aria-hidden>😊</span>
      </button>
      {open && (
        <div role="group" aria-label="이모지 고르기" className="absolute left-0 top-full mt-2 grid w-60 grid-cols-6 gap-0.5 rounded-2xl bg-card/95 p-1.5 shadow-lg backdrop-blur">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onPick(emoji)}
              className="flex aspect-square items-center justify-center rounded-lg text-xl hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
