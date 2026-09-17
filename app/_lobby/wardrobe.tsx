"use client";

import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib";
import { dressSprite, type Outfit, SLOT_INFO, spriteName, WARDROBE_SLOTS, type WardrobeSlot, wardrobeSrc, wear } from "@/lib/lobby/wardrobe";

import { drawOutfit } from "./outfit-canvas";

export const CAPYBARA_SRC = "/assets/images/characters/capybara/capybara-idle-down.webp";

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
        <div className="relative size-20 shrink-0 md:size-24">
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
                  "min-h-10 shrink-0 rounded-full px-3 text-caption-1 font-semibold focus-visible:outline-2 focus-visible:outline-primary",
                  slot === s ? "bg-primary text-primary-foreground" : "bg-card text-text-caption",
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
            "flex aspect-square flex-col items-center justify-center rounded-xl border text-caption-2 text-text-caption focus-visible:outline-2 focus-visible:outline-primary",
            !outfit[slot] ? "border-primary" : "border-border-default",
          )}
        >
          없음
        </button>
        {SLOT_INFO[slot].items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => choose(item.id)}
            aria-pressed={outfit[slot] === item.id}
            className={cn(
              "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border p-1 text-caption-3 text-text-caption focus-visible:outline-2 focus-visible:outline-primary",
              outfit[slot] === item.id ? "border-primary text-text-strong" : "border-border-default",
            )}
          >
            <NextImage src={wardrobeSrc(slot, item.id)} alt="" width={96} height={96} unoptimized className="min-h-0 flex-1 object-contain" />
            <span className="w-full truncate text-center">{item.label}</span>
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

/** 로비 맵과 같은 스프라이트 자리·같은 합성(outfit-canvas.ts drawOutfit)으로 그린 옷장 미리보기 */
function OutfitPreview({ outfit }: { outfit: Outfit }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { silhouette, under, over } = dressSprite(spriteName(CAPYBARA_SRC), outfit);
    const images = [CAPYBARA_SRC, ...[...silhouette, ...under, ...over].map((piece) => piece.src)].map(previewImage);
    let cancelled = false;
    // 이미지를 다 불러온 뒤에 그린다 (덜 불러온 옷은 drawOutfit이 건너뛴다)
    Promise.all(images.map((image) => image.decode().catch(() => undefined))).then(() => {
      if (cancelled) return;
      const [base] = images;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
      drawOutfit({ ctx, base, outfit, left: 0, top: 0, size: canvas.width, imageFor: previewImage });
    });
    return () => {
      cancelled = true;
    };
  }, [outfit]);
  return <canvas ref={canvasRef} width={448} height={448} aria-hidden className="size-full" />;
}
