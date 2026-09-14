"use client";

import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";

import { Checkbox } from "@/components/inputs/checkbox";
import { cn } from "@/lib";
import type { LobbySettings } from "@/lib/lobby/settings";

import { SETTINGS_BUTTON_SRC, SOUND_OFF_BUTTON_SRC, SOUND_ON_BUTTON_SRC } from "./constants";

interface SettingsProps {
  settings: LobbySettings;
  onChange: (settings: LobbySettings) => void;
}

/** 때리기·앉기 버튼과 같은 나무 테·펠트 판 둥근 버튼. 테두리까지 그림에 있어서 배경·테두리를 따로 그리지 않는다 */
const FELT_BUTTON = "group rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function FeltButtonImage({ src, className }: { src: string; className?: string }) {
  return (
    <NextImage
      src={src}
      alt=""
      width={256}
      height={256}
      unoptimized
      draggable={false}
      className={cn("size-12 drop-shadow-md transition-transform duration-200 motion-safe:group-active:scale-90 motion-reduce:transition-none", className)}
    />
  );
}

/** 카피바라 아래 효과음 켜고 끄기 */
export function SoundToggle({ settings, onChange }: SettingsProps) {
  return (
    <button
      type="button"
      onClick={() => onChange({ ...settings, muted: !settings.muted })}
      aria-label="효과음"
      aria-pressed={!settings.muted}
      className={FELT_BUTTON}
    >
      <FeltButtonImage src={settings.muted ? SOUND_OFF_BUTTON_SRC : SOUND_ON_BUTTON_SRC} />
    </button>
  );
}

/** 오른쪽 위 버튼 줄의 톱니바퀴. 누르면 버튼 줄 왼쪽에 설정 창이 열린다 */
export function SettingsMenu({ settings, onChange }: SettingsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button ref={buttonRef} type="button" onClick={() => setOpen((value) => !value)} aria-label="설정" aria-expanded={open} className={FELT_BUTTON}>
        <FeltButtonImage src={SETTINGS_BUTTON_SRC} className={cn(open && "rotate-45")} />
      </button>
      {open && (
        <section
          role="dialog"
          aria-label="설정"
          className="absolute right-full top-0 mr-2 flex w-60 flex-col gap-4 rounded-2xl bg-card/95 p-4 text-text-strong shadow-lg backdrop-blur"
        >
          <h2 className="text-title-3 font-bold">설정</h2>
          <Checkbox label="효과음" checked={!settings.muted} onCheckedChange={(checked) => onChange({ ...settings, muted: checked !== true })} />
          <label className="flex flex-col gap-2 text-caption-1 text-text-caption">
            효과음 크기
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.volume * 100)}
              disabled={settings.muted}
              onChange={(event) => onChange({ ...settings, volume: Number(event.currentTarget.value) / 100 })}
              className="h-6 w-full accent-primary disabled:opacity-50"
            />
          </label>
          <Checkbox
            label="조작법 안내 보기"
            checked={settings.showHelp}
            onCheckedChange={(checked) => onChange({ ...settings, showHelp: checked === true })}
          />
        </section>
      )}
    </div>
  );
}
