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

/** 카피바라 아래 효과음 켜고 끄기. 마우스를 올리거나(키보드는 포커스) 하면 왼쪽에 음량 슬라이더가 나온다 */
export function SoundToggle({ settings, onChange }: SettingsProps) {
  const volume = settings.muted ? 0 : Math.round(settings.volume * 100);
  const Icon = volume === 0 ? VolumeX : Volume2;
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onChange({ ...settings, muted: !settings.muted })}
        aria-label="효과음"
        aria-pressed={!settings.muted}
        className={cn(
          "flex size-11 items-center justify-center rounded-full bg-card/90 text-text-strong shadow-md backdrop-blur hover:bg-card focus-visible:outline-2 focus-visible:outline-primary",
          volume === 0 && "text-text-caption",
        )}
      >
        <Icon aria-hidden className="size-5" />
      </button>
      {/* pr-2가 버튼과 슬라이더 사이 틈을 메워서, 마우스를 슬라이더로 옮기는 중에 hover가 끊기지 않는다 */}
      <div className="pointer-events-none absolute right-full top-0 pr-2 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 motion-reduce:transition-none">
        <label className="flex h-11 items-center gap-2 rounded-full bg-card/90 pl-4 pr-3 shadow-md backdrop-blur">
          <span className="sr-only">효과음 크기</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            // 음소거 중에 음량을 올리면 소리도 같이 켠다
            onChange={(event) => onChange({ ...settings, volume: Number(event.currentTarget.value) / 100, muted: false })}
            className="h-6 w-28 accent-primary"
          />
          <span aria-hidden className="w-9 text-right text-caption-2 tabular-nums text-text-strong">
            {volume}%
          </span>
        </label>
      </div>
    </div>
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
