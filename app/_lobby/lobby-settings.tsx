"use client";

import { Settings, Volume2, VolumeX } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Checkbox } from "@/components/inputs/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib";
import { type LobbySettings, toggledSound, withVolume } from "@/lib/lobby/settings";

import { SOUND_BUTTON_SRC } from "./constants";
import { useLobbyMenuPanel } from "./lobby-menu";
import { flashButton, isShortcutKey } from "./shortcut";

interface SettingsProps {
  settings: LobbySettings;
  onChange: (settings: LobbySettings) => void;
}

/** 세로 툴바 안 아이콘 버튼. 모바일 터치 영역 44px을 지킨다 */
const TOOL_BUTTON = "size-11 rounded-lg text-text-strong";

const HEADPHONES = { src: "/assets/images/ui/lobby/headphones.webp", top: -4, width: 112, height: 92 };
/**
 * 카피바라 아래 효과음 켜고 끄기. 헤드폰을 끼면 켜짐, 벗으면 꺼짐.
 * 마우스는 올리면(키보드는 포커스) 왼쪽에 음량 슬라이더가 나온다.
 * 터치는 hover가 없어서 첫 탭은 음량 알약만 열고, 열린 동안 탭하면 켜고 끈다. 조작이 멈추거나 다른 곳을 누르면 닫혀 화면을 가리지 않는다
 */
export function SoundToggle({ settings, onChange }: SettingsProps) {
  const volume = settings.muted ? 0 : Math.round(settings.volume * 100);
  const { open: peek, panelHost, setOpen: setPeek } = useLobbyMenuPanel("sound");
  const rootRef = useRef<HTMLDivElement>(null);

  // M: 소리 켜고 끄기 (S는 WASD 아래로 걷기라서 M)
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!isShortcutKey(event, "KeyM")) return;
    event.preventDefault();
    // 아이콘 오버레이의 group이 감싼 div라서 거기에 표시한다
    flashButton(rootRef.current);
    setPeek(true);
    onChange(toggledSound(settings));
  });
  useEffect(() => {
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  return (
    <div ref={rootRef} className="group relative min-w-0 overflow-hidden rounded-full">
      <button
        type="button"
        onClick={() => setPeek((value) => !value)}
        aria-label="효과음"
        aria-expanded={peek}
        aria-pressed={volume > 0}
        aria-keyshortcuts="M"
        // 크기는 오른쪽 아래 앉기·때리기 버튼(모바일 size-14, md 이상 size-18)과 같게. 헤드폰 위치는 버튼 기준 %라 같이 커진다
        className="relative size-14 md:size-18 rounded-full focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span aria-hidden className="relative block size-full">
          <NextImage src={SOUND_BUTTON_SRC} alt="" width={256} height={256} unoptimized draggable={false} className="size-full drop-shadow-md" />
          {/* 마우스를 올리거나 키보드 포커스·터치로 알약이 열렸으면 나무 테 안쪽 판 위에 지금 상태 스피커 아이콘 */}
          <span
            className={cn(
              "absolute inset-[16%] flex items-center justify-center rounded-full bg-overlay text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 group-data-flash:opacity-100 motion-reduce:transition-none",
              peek && "opacity-100",
            )}
          >
            {volume === 0 ? <VolumeX className="size-6 md:size-7" /> : <Volume2 className="size-6 md:size-7" />}
          </span>
        </span>
        {/* 인라인 translate로 자리를 잡으니, 벗는 연출은 translate 대신 scale·opacity로 한다 */}
        <NextImage
          src={HEADPHONES.src}
          alt=""
          width={256}
          height={256}
          unoptimized
          className={cn(
            "absolute left-1/2 max-w-none object-fill transition-[opacity,scale] duration-150 motion-reduce:transition-none",
            volume === 0 ? "scale-75 opacity-0" : "opacity-100",
          )}
          style={{
            top: `${HEADPHONES.top}%`,
            width: `${HEADPHONES.width}%`,
            height: `${HEADPHONES.height}%`,
            translate: "-50% 0",
          }}
        />
      </button>
      {peek && panelHost && createPortal(<section role="region" aria-label="효과음 설정" className="border-t border-border-default pt-4">
        <h2 className="mb-3 text-title-3 font-bold text-text-strong">효과음 설정</h2>
        <label
          className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl bg-muted px-4"
        >
          <span className="sr-only">효과음 크기</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            // 음소거 중에 음량을 올리면 소리도 같이 켜고, 0으로 내리면 끄되 직전 음량은 남긴다 (게임 멈춤 창과 같은 규칙)
            onChange={(event) => onChange(withVolume(settings, Number(event.currentTarget.value) / 100))}
            // 게이지는 카피바라 털색: 찬 쪽 털색, 빈 쪽 밝은 털색, 손잡이는 주둥이색.
            // 누르는 영역은 알약 높이(44px) 전체, 보이는 막대는 가운데 8px만(bg-clip-content). 터치 기기는 손잡이를 키운다
            className="h-11 min-w-0 flex-1 cursor-pointer touch-none appearance-none rounded-full bg-clip-content py-[18px] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-capybara-dark [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-capybara-dark [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-capybara-dark [&::-webkit-slider-thumb]:shadow-md pointer-coarse:[&::-moz-range-thumb]:size-6 pointer-coarse:[&::-webkit-slider-thumb]:size-6"
            // background 단축 속성은 bg-clip-content를 초기화해서 막대가 44px 전체로 칠해진다 — backgroundImage만 준다
            style={{ backgroundImage: `linear-gradient(to right, var(--capybara) ${volume}%, var(--capybara-light) ${volume}%)` }}
          />
          <span aria-hidden className="w-9 text-right text-caption-2 tabular-nums text-text-strong">
            {volume}%
          </span>
        </label>
      </section>, panelHost)}
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
