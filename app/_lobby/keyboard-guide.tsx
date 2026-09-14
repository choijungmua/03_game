"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { cn } from "@/lib";

import { KEYBOARD_ROWS, LOBBY_KEY_GUIDE } from "./constants";
import { isShortcutKey } from "./shortcut";

const USED_KEYS = new Set<string>(LOBBY_KEY_GUIDE.flatMap((guide) => guide.keys));

/** 키보드 그림의 키 하나. 로비에서 쓰는 키만 색을 채운다 */
function Key({ label, className }: { label: string; className?: string }) {
  const used = USED_KEYS.has(label);
  return (
    <kbd
      className={cn(
        "flex h-8 min-w-0 flex-1 items-center justify-center rounded-md border font-sans text-caption-3 font-semibold sm:h-10",
        used ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border-default text-text-caption opacity-50",
        className,
      )}
    >
      {label}
    </kbd>
  );
}

/** \ 키로 여닫는 조작법 창: 키보드 그림에 로비에서 쓰는 키를 칠하고, 아래에 키마다 하는 일을 적는다 */
export function KeyboardGuide() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  /** 닫으면 열기 전에 포커스가 있던 곳으로 돌려준다 */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = () => {
    setOpen(false);
    returnFocusRef.current?.focus();
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (open && event.key === "Escape") {
      close();
      return;
    }
    if (!isShortcutKey(event, "Backslash")) return;
    event.preventDefault();
    if (open) {
      close();
      return;
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  });
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    // 바깥(어두운 배경)을 누르면 닫힌다
    <div className="fixed inset-0 z-30 flex items-center justify-center overscroll-contain bg-overlay px-4" onClick={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-guide-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl bg-card/95 p-4 shadow-lg backdrop-blur sm:p-6"
      >
        <div className="flex items-center justify-between">
          <h2 id="keyboard-guide-title" className="text-title-3 font-bold text-text-strong">
            조작법
          </h2>
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

        {/* 키보드 그림: 스크린리더는 아래 설명 목록으로 읽으니 숨긴다 */}
        <div aria-hidden className="flex flex-col gap-1 sm:gap-1.5">
          <div className="flex">
            <Key label="Esc" className="max-w-12 sm:max-w-16" />
          </div>
          {KEYBOARD_ROWS.map((row, index) => (
            // 실제 키보드처럼 아래 줄로 갈수록 오른쪽으로 조금씩 민다
            <div key={row.join("")} className="flex gap-1 sm:gap-1.5" style={{ paddingLeft: `${index * 3}%` }}>
              {row.map((label) => (
                <Key key={label} label={label} className={label === "Enter" ? "flex-[1.8]" : undefined} />
              ))}
            </div>
          ))}
          <div className="flex items-end gap-1 sm:gap-1.5">
            <Key label="Space" className="ml-[18%] flex-[5]" />
            <div className="ml-auto grid w-[24%] grid-cols-3 gap-1 sm:gap-1.5">
              <span />
              <Key label="↑" />
              <span />
              <Key label="←" />
              <Key label="↓" />
              <Key label="→" />
            </div>
          </div>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {LOBBY_KEY_GUIDE.map(({ keys, label }) => (
            <li key={label} className="flex min-w-0 items-center gap-3 rounded-xl border border-border-default px-3 py-2">
              <span className="flex shrink-0 flex-wrap gap-1">
                {keys.map((key) => (
                  <kbd
                    key={key}
                    className="flex h-6 min-w-6 items-center justify-center rounded border border-border-default bg-muted px-1.5 font-sans text-caption-3 font-semibold text-text-strong"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
              <span className="min-w-0 text-caption-1 text-text-strong">{label}</span>
            </li>
          ))}
          <li className="flex min-w-0 items-center rounded-xl border border-dashed border-border-default px-3 py-2 text-caption-1 text-text-caption sm:col-span-2">
            오두막 문 앞으로 걸어가면 게임에 들어가요. 마우스로 누른 곳으로도 걸어가요
          </li>
        </ul>
      </section>
    </div>
  );
}
