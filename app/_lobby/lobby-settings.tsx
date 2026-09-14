"use client";

import { Settings, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Checkbox } from "@/components/inputs/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib";
import type { LobbySettings } from "@/lib/lobby/settings";

interface SettingsProps {
  settings: LobbySettings;
  onChange: (settings: LobbySettings) => void;
}

/** 세로 툴바 안 아이콘 버튼. 모바일 터치 영역 44px을 지킨다 */
const TOOL_BUTTON = "size-11 rounded-lg text-text-strong";

/** 오른쪽 위 세로 툴바 카드. 설정·효과음 버튼을 한데 묶는다 */
export const TOOLBAR = "flex flex-col gap-1 rounded-xl border border-border-default bg-card/90 p-1 shadow-md backdrop-blur";

/** 설정 아래 효과음 켜고 끄기 */
export function SoundToggle({ settings, onChange }: SettingsProps) {
  const Icon = settings.muted ? VolumeX : Volume2;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onChange({ ...settings, muted: !settings.muted })}
      aria-label="효과음"
      aria-pressed={!settings.muted}
      className={cn(TOOL_BUTTON, settings.muted && "text-text-caption")}
    >
      <Icon aria-hidden className="size-5" />
    </Button>
  );
}

/** 오른쪽 위 톱니바퀴. 누르면 아래 버튼을 가리지 않게 왼쪽으로 설정 창이 열린다 */
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
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        onClick={() => setOpen((value) => !value)}
        aria-label="설정"
        aria-expanded={open}
        className={cn(TOOL_BUTTON, open && "text-primary")}
      >
        <Settings aria-hidden className={cn("size-5 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-45")} />
      </Button>
      {open && (
        <section
          role="dialog"
          aria-label="설정"
          className="absolute right-full top-0 mr-2 flex w-60 flex-col gap-4 rounded-xl border border-border-default bg-card/95 p-4 text-text-strong shadow-lg backdrop-blur"
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
