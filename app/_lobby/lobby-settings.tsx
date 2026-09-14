"use client";

import { Settings } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";

import { Checkbox } from "@/components/inputs/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib";
import type { LobbySettings } from "@/lib/lobby/settings";

import { CAPYBARA_SRC } from "./wardrobe";

interface SettingsProps {
  settings: LobbySettings;
  onChange: (settings: LobbySettings) => void;
}

/** 세로 툴바 안 아이콘 버튼. 모바일 터치 영역 44px을 지킨다 */
const TOOL_BUTTON = "size-11 rounded-lg text-text-strong";

/**
 * 헤드폰 위치: 둥근 버튼 기준 %. 얼굴을 확대해 보여 주는 버튼이라 원본 머리에 맞추면 머리띠·이어컵이 잘려서, 버튼 원에 맞춘다.
 * 헤드폰 그림은 머리띠 활이 높아서, 원보다 넓게(이어컵은 원 가장자리) 두고 세로를 눌러 머리띠는 위 끝·이어컵은 눈 높이에 오게 한다
 */
const HEADPHONES = { src: "/assets/images/ui/lobby/headphones.webp", top: -5, width: 118, height: 85 };

/** 카피바라 아래 효과음 켜고 끄기. 헤드폰을 끼면 켜짐, 벗으면 꺼짐. 마우스를 올리거나(키보드는 포커스) 하면 왼쪽에 음량 슬라이더가 나온다 */
export function SoundToggle({ settings, onChange }: SettingsProps) {
  const volume = settings.muted ? 0 : Math.round(settings.volume * 100);
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onChange({ ...settings, muted: !settings.muted })}
        aria-label="효과음"
        aria-pressed={!settings.muted}
        className="relative size-14 overflow-hidden rounded-full bg-card/90 shadow-md backdrop-blur focus-visible:outline-2 focus-visible:outline-primary"
      >
        {/* 옷장 버튼과 같은 얼굴 확대 */}
        <span aria-hidden className="relative block size-full origin-[50%_30%] scale-[1.9]">
          <NextImage src={CAPYBARA_SRC} alt="" fill unoptimized sizes="112px" />
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
      {/* pr-2가 버튼과 슬라이더 사이 틈을 메워서, 마우스를 슬라이더로 옮기는 중에 hover가 끊기지 않는다.
          키보드는 focus-visible일 때만 연다 (focus-within이면 마우스로 누른 뒤 포커스가 남아 슬라이더가 안 닫힌다) */}
      <div className="pointer-events-none absolute right-full top-1.5 pr-2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-has-[:focus-visible]:pointer-events-auto group-has-[:focus-visible]:opacity-100 motion-reduce:transition-none">
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
