"use client";

import NextImage from "next/image";
import { useState } from "react";

import { cn } from "@/lib";
import {
  dressSprite,
  type Outfit,
  type OutfitPiece,
  SLOT_INFO,
  spriteName,
  WARDROBE_SLOTS,
  type WardrobeSlot,
  wardrobeSrc,
  wear,
} from "@/lib/lobby/wardrobe";

export const CAPYBARA_SRC = "/assets/images/characters/capybara/capybara-idle-down.webp";

/** 내 카피바라 메뉴의 옷장 탭: 입힌 모습 미리보기 + 부위별 옷 고르기 */
export function Wardrobe({ outfit, onChange }: { outfit: Outfit; onChange: (outfit: Outfit) => void }) {
  const [slot, setSlot] = useState<WardrobeSlot>("hat");

  const choose = (id: string | null) => {
    const next = wear(outfit, slot, id);
    onChange(next);
  };

  // 로비 맵의 앉은 정면과 같은 스프라이트·같은 자리
  const { silhouette, under, face, redraw, over } = dressSprite(spriteName(CAPYBARA_SRC), outfit);
  const layers = (pieces: readonly OutfitPiece[]) =>
    pieces.map((piece, index) => {
      const [cropLeft, cropTop, cropWidth, cropHeight] = piece.crop ?? [0, 0, 1, 1];
      return (
        <div
          key={`${piece.src}-${index}`}
          className="absolute overflow-hidden"
          aria-hidden="true"
          style={{
            left: `${piece.left}%`,
            top: `${piece.top}%`,
            width: `${piece.width}%`,
            height: `${piece.height}%`,
            transform: piece.mirror ? "scaleX(-1)" : undefined,
          }}
        >
          <NextImage
            src={piece.src}
            alt=""
            width={256}
            height={256}
            unoptimized
            className="absolute max-w-none"
            style={{
              left: `${(-cropLeft / cropWidth) * 100}%`,
              top: `${(-cropTop / cropHeight) * 100}%`,
              width: `${100 / cropWidth}%`,
              height: `${100 / cropHeight}%`,
            }}
          />
        </div>
      );
    });

  return (
    <section aria-label="카피바라 옷 입히기" className="flex w-full flex-col gap-3">
      {/* 키 큰 모자가 머리 위로 삐져나오는 만큼 받침 위쪽을 넉넉히 둔다 */}
      <div className="rounded-2xl bg-muted/60 pb-2 pt-5">
        <div className="relative mx-auto aspect-square w-full max-w-32 md:max-w-40">
          <NextImage src={CAPYBARA_SRC} alt="" fill unoptimized sizes="224px" />
          {/* 채움층은 몸과 움직이는 팔을 옷감으로 덮고, 원본층은 그 위에서 소매·후드·꼬리처럼 몸 밖으로 나온 옷 윤곽을 보존한다 */}
          <div
            className="absolute inset-0"
            style={{ maskImage: `url(${CAPYBARA_SRC})`, maskSize: "100% 100%", WebkitMaskImage: `url(${CAPYBARA_SRC})`, WebkitMaskSize: "100% 100%" }}
          >
            {layers(under)}
          </div>
          {layers(silhouette)}
          {face.map(({ source: [sourceX, sourceY, sourceRx, sourceRy], clip: [cx, cy, rx, ry] }, index) => {
            const scaleX = rx / sourceRx;
            const scaleY = ry / sourceRy;
            return (
              <div key={`face-${index}`} aria-hidden className="absolute inset-0 overflow-hidden" style={{ clipPath: `ellipse(${rx}% ${ry}% at ${cx}% ${cy}%)` }}>
                <NextImage
                  src={CAPYBARA_SRC}
                  alt=""
                  width={256}
                  height={256}
                  unoptimized
                  className="absolute max-w-none"
                  style={{
                    left: `${cx - sourceX * scaleX}%`,
                    top: `${cy - sourceY * scaleY}%`,
                    width: `${scaleX * 100}%`,
                    height: `${scaleY * 100}%`,
                  }}
                />
              </div>
            );
          })}
          {redraw.map(([cx, cy, rx, ry], index) => (
            <NextImage
              key={`redraw-${index}`}
              src={CAPYBARA_SRC}
              alt=""
              fill
              unoptimized
              sizes="224px"
              style={{ clipPath: `ellipse(${rx}% ${ry}% at ${cx}% ${cy}%)` }}
            />
          ))}
          {layers(over)}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {WARDROBE_SLOTS.flatMap((s) => SLOT_INFO[s].items.filter((item) => item.id === outfit[s]).map((item) => item.label)).join(", ") ||
          "아무것도 안 입음"}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {WARDROBE_SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSlot(s)}
            aria-pressed={slot === s}
            className={cn(
              "min-h-10 rounded-full px-3 text-caption-1 font-semibold focus-visible:outline-2 focus-visible:outline-primary",
              slot === s ? "bg-primary text-primary-foreground" : "bg-muted text-text-caption",
              outfit[s] && slot !== s && "text-text-strong",
            )}
          >
            {SLOT_INFO[s].label}
          </button>
        ))}
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
