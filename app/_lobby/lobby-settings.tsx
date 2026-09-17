"use client";

import { Settings, Volume2, VolumeX } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { Checkbox } from "@/components/inputs/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib";
import { type LobbySettings, toggledSound, withVolume } from "@/lib/lobby/settings";

import { useLobbyMenuPanel } from "./lobby-menu";
import { isShortcutKey } from "./shortcut";

interface SettingsProps {
  settings: LobbySettings;
  onChange: (settings: LobbySettings) => void;
}

/** 세로 툴바 안 아이콘 버튼. 모바일 터치 영역 44px을 지킨다 */
const TOOL_BUTTON = "size-11 rounded-lg text-text-strong";

/** 내 카피바라 메뉴의 소리 탭: 켜고 끄는 스위치 + 음량. M은 어디서든 소리를 켜고 끄며 이 탭을 연다 (S는 WASD 아래로 걷기라서 M) */
export function SoundSettings({ settings, onChange }: SettingsProps) {
  const volume = settings.muted ? 0 : Math.round(settings.volume * 100);
  const on = volume > 0;
  const { openTab } = useLobbyMenuPanel("sound");

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!isShortcutKey(event, "KeyM")) return;
    event.preventDefault();
    openTab();
    onChange(toggledSound(settings));
  });
  useEffect(() => {
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  return (
    <section aria-label="효과음 설정" className="flex flex-col gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="효과음"
        aria-keyshortcuts="M"
        onClick={() => onChange(toggledSound(settings))}
        className="flex min-h-16 w-full touch-manipulation items-center gap-3 rounded-2xl bg-muted/60 px-4 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
      >
        {on ? <Volume2 aria-hidden className="size-6 shrink-0 text-text-strong" /> : <VolumeX aria-hidden className="size-6 shrink-0 text-text-caption" />}
        <span className="min-w-0 flex-1">
          <span className="block text-body-2 font-semibold text-text-strong">효과음</span>
          <span className="block text-caption-2 text-text-caption">{on ? "켜짐" : "꺼짐"}</span>
        </span>
        {/* 스위치 모양: 켜지면 판이 오른쪽으로 미끄러지고 트랙이 카피바라 털색이 된다 */}
        <span aria-hidden className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150", on ? "bg-capybara" : "bg-border-default")}>
          <span
            className={cn(
              "absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-150 motion-reduce:transition-none",
              on && "translate-x-5",
            )}
          />
        </span>
      </button>
      <label className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-2xl bg-muted/60 px-4">
        <span className="shrink-0 text-caption-1 font-semibold text-text-strong">크기</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          aria-label="효과음 크기"
          // 음소거 중에 음량을 올리면 소리도 같이 켜고, 0으로 내리면 끄되 직전 음량은 남긴다 (게임 멈춤 창과 같은 규칙)
          onChange={(event) => onChange(withVolume(settings, Number(event.currentTarget.value) / 100))}
          // 게이지는 카피바라 털색: 찬 쪽 털색, 빈 쪽 밝은 털색, 손잡이는 주둥이색.
          // 누르는 영역은 44px 전체, 보이는 막대는 가운데 8px만(bg-clip-content). 터치 기기는 손잡이를 키운다
          className="h-11 min-w-0 flex-1 cursor-pointer touch-none appearance-none rounded-full bg-clip-content py-[18px] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-capybara-dark [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-capybara-dark [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-capybara-dark [&::-webkit-slider-thumb]:shadow-md pointer-coarse:[&::-moz-range-thumb]:size-6 pointer-coarse:[&::-webkit-slider-thumb]:size-6"
          // background 단축 속성은 bg-clip-content를 초기화해서 막대가 44px 전체로 칠해진다 — backgroundImage만 준다
          style={{ backgroundImage: `linear-gradient(to right, var(--capybara) ${volume}%, var(--capybara-light) ${volume}%)` }}
        />
        <span aria-hidden className="w-10 text-right text-caption-1 tabular-nums text-text-strong">
          {volume}%
        </span>
      </label>
    </section>
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
