"use client";

import { Settings, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Checkbox } from "@/components/inputs/checkbox";
import { cn } from "@/lib";
import type { LobbySettings } from "@/lib/lobby/settings";

interface SettingsProps {
  settings: LobbySettings;
  onChange: (settings: LobbySettings) => void;
}

const ROUND_BUTTON =
  "flex size-11 items-center justify-center rounded-full bg-card/90 text-text-strong shadow-md backdrop-blur hover:bg-card focus-visible:outline-2 focus-visible:outline-primary";

/** 카피바라 옆 효과음 켜고 끄기 */
export function SoundToggle({ settings, onChange }: SettingsProps) {
  const Icon = settings.muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      onClick={() => onChange({ ...settings, muted: !settings.muted })}
      aria-label="효과음"
      aria-pressed={!settings.muted}
      className={ROUND_BUTTON}
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}

/** 오른쪽 위 톱니바퀴. 누르면 바로 아래에 설정 창이 열린다 */
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
      <button ref={buttonRef} type="button" onClick={() => setOpen((value) => !value)} aria-label="설정" aria-expanded={open} className={ROUND_BUTTON}>
        <Settings aria-hidden className={cn("size-5 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-45")} />
      </button>
      {open && (
        <section
          role="dialog"
          aria-label="설정"
          className="absolute right-0 top-full mt-2 flex w-60 flex-col gap-4 rounded-2xl bg-card/95 p-4 text-text-strong shadow-lg backdrop-blur"
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
