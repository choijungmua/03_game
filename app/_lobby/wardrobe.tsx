"use client";

import { Ban } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib";
import { CHARACTER_3D, drawDressed, type Outfit, outfitSheets, SLOT_INFO, WARDROBE_SLOTS, type WardrobeSlot, wardrobeIconSrc, wear } from "@/lib/lobby/wardrobe";

/** 옷장 미리보기: 정면 대각선으로 서 있는 모습 (옷 모양이 가장 잘 보인다) */
export const CAPYBARA_SRC = `${CHARACTER_3D}/capybara-stand-down-right.webp`;

/** 내 카피바라 메뉴의 옷장 탭: 입힌 모습 미리보기 + 부위별 옷 고르기 */
export function Wardrobe({ outfit, onChange }: { outfit: Outfit; onChange: (outfit: Outfit) => void }) {
  const [slot, setSlot] = useState<WardrobeSlot>("hat");

  const choose = (id: string | null) => {
    onChange(wear(outfit, slot, id));
  };

  return (
    <section aria-label="카피바라 옷 입히기" className="flex w-full flex-col gap-3">
      {/* 위: 작은 미리보기 + 지금 입은 옷 + 부위 칩. 목록을 내려도 붙어 있어 부위를 바로 바꾼다 */}
      <div className="sticky top-0 z-[1] flex items-center gap-3 rounded-2xl bg-muted p-2 pr-3">
        {/* 키 큰 모자가 머리 위로 조금 나와도 잘리지 않게 overflow는 그대로 둔다 */}
        <div className="relative size-28 shrink-0 md:size-24">
          <OutfitPreview outfit={outfit} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p aria-live="polite" className="truncate text-caption-1 text-text-caption">
            {WARDROBE_SLOTS.flatMap((s) => SLOT_INFO[s].items.filter((item) => item.id === outfit[s]).map((item) => item.label)).join(" · ") ||
              "아무것도 안 입음"}
          </p>
          <div className="flex gap-1.5">
            {WARDROBE_SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlot(s)}
                aria-pressed={slot === s}
                className={cn(
                  "min-h-10 shrink-0 touch-manipulation rounded-full px-3.5 text-caption-1 font-semibold transition-[background-color,color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-primary motion-safe:active:scale-95 motion-reduce:transition-none",
                  slot === s ? "bg-primary text-primary-foreground shadow-sm" : "text-text-caption ring-1 ring-inset ring-border-default hover:bg-card hover:text-text-strong",
                  outfit[s] && slot !== s && "text-text-strong",
                )}
              >
                {SLOT_INFO[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => choose(null)}
          aria-pressed={!outfit[slot]}
          className={cn(
            "flex aspect-square touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl text-caption-2 font-semibold text-text-caption ring-1 transition-[background-color,color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-primary motion-safe:active:scale-95 motion-reduce:transition-none",
            !outfit[slot] ? "bg-capybara/15 text-text-strong ring-2 ring-primary" : "bg-muted/50 ring-border-default hover:bg-muted",
          )}
        >
          <Ban aria-hidden className="size-6 opacity-70" />
          없음
        </button>
        {SLOT_INFO[slot].items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => choose(item.id)}
            aria-pressed={outfit[slot] === item.id}
            className={cn(
              "relative flex aspect-square touch-manipulation flex-col items-center justify-center gap-0.5 overflow-hidden rounded-2xl p-1.5 text-caption-3 text-text-caption ring-1 transition-[background-color,color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-primary motion-safe:active:scale-95 motion-reduce:transition-none",
              outfit[slot] === item.id ? "bg-capybara/15 text-text-strong ring-2 ring-primary" : "bg-muted/50 ring-border-default hover:bg-muted",
            )}
          >
            {/* 그림은 이름을 뺀 남는 칸 안에만 — 고정 폭(96px)으로 두면 좁은 카드에서 좌우로, 두 줄 이름과 겹치면 위아래로 삐져나왔다 */}
            <span className="relative min-h-0 w-full flex-1">
              <NextImage src={wardrobeIconSrc(slot, item.id)} alt="" fill sizes="96px" unoptimized className="object-contain" />
            </span>
            {/* 긴 이름(유자 온천 수건)도 잘리지 않게 두 줄까지 */}
            <span className="line-clamp-2 w-full break-keep text-center leading-tight">{item.label}</span>
            {item.special && (
              <span className="absolute right-1 top-0.5 text-caption-3">
                <span aria-hidden>✨</span>
                <span className="sr-only">특별한 옷</span>
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

const previewImages = new Map<string, HTMLImageElement>();
const previewImage = (src: string) => {
  const cached = previewImages.get(src);
  if (cached) return cached;
  const image = new Image();
  image.src = src;
  previewImages.set(src, image);
  return image;
};

/** 로비 맵과 같은 합성(lib/lobby/wardrobe.ts drawDressed)으로 그린 옷장 미리보기 */
function OutfitPreview({ outfit }: { outfit: Outfit }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const images = [CAPYBARA_SRC, ...outfitSheets(outfit)].map(previewImage);
    let cancelled = false;
    // 이미지를 다 불러온 뒤에 그린다 (덜 불러온 옷은 drawDressed가 건너뛴다)
    Promise.all(images.map((image) => image.decode().catch(() => undefined))).then(() => {
      if (cancelled) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawDressed(ctx, images[0], outfit, [0, 0, canvas.width], previewImage);
    });
    return () => {
      cancelled = true;
    };
  }, [outfit]);
  return <canvas ref={canvasRef} width={448} height={448} aria-hidden className="size-full" />;
}
