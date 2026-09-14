"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { GuestbookBoard } from "@/app/guestbook/guestbook-board";

/**
 * 로비 게시판 앞에서 Space로 여는 방명록 창. 열 때만 그려서 열 때마다 최신 글을 다시 불러온다.
 * 이용약관 종이(LegalPage)와 같은 크림색 종이 — 방명록 본문이 그 글자색 토큰을 그대로 쓴다
 */
export function GuestbookPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") onClose();
  });

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  if (!open) return null;

  return (
    // 바깥(어두운 막)을 누르면 닫힌다. z-30: 오른쪽 위 옷장·가방 창(z-10) 위
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 px-4 py-[max(1rem,env(safe-area-inset-top))]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-label="방명록"
        className="relative max-h-full w-[min(28rem,100%)] space-y-6 overflow-y-auto overscroll-contain rounded-[2rem] border-8 border-capybara bg-[color-mix(in_oklab,var(--capybara-light)_28%,white)] px-5 py-6 text-sm leading-relaxed text-muted-foreground shadow-xl scheme-light [--foreground:var(--capybara-dark)] [--muted-foreground:color-mix(in_oklab,var(--capybara-dark)_80%,var(--capybara-light))]"
      >
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-xl font-bold text-foreground">방명록</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex size-10 items-center justify-center rounded-full text-xl text-foreground hover:bg-capybara/15 focus-visible:outline-2 focus-visible:outline-capybara-dark"
          >
            ×
          </button>
        </div>
        <GuestbookBoard />
      </section>
    </div>
  );
}
