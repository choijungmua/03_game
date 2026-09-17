"use client";

import { Shirt } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { cn } from "@/lib";
import {
  dressSprite,
  loadOutfit,
  type Outfit,
  saveOutfit,
  SLOT_INFO,
  spriteName,
  WARDROBE_SLOTS,
  type WardrobeSlot,
  wardrobeSrc,
  wear,
} from "@/lib/lobby/wardrobe";

import { WARDROBE_BUTTON_SRC } from "./constants";
import { drawOutfit } from "./outfit-canvas";
import { flashButton, isShortcutKey } from "./shortcut";

export const CAPYBARA_SRC = "/assets/images/characters/capybara/capybara-idle-down.webp";

/** 오른쪽 위 카피바라 얼굴 버튼. 누르면 그 자리에서 커지며 옷 입히기 창이 열린다 */
export function Wardrobe({ onChange }: { onChange: (outfit: Outfit) => void }) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<WardrobeSlot>("hat");
  const [outfit, setOutfit] = useState<Outfit>({});
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 옷은 창 안에서만 보이니, 서버 렌더와 어긋나지 않게 열 때 저장값을 불러온다
  const openWardrobe = () => {
    setOutfit(loadOutfit());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      openButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const choose = (id: string | null) => {
    const next = wear(outfit, slot, id);
    setOutfit(next);
    saveOutfit(next);
    onChange(next);
  };

  const close = () => {
    setOpen(false);
    openButtonRef.current?.focus();
  };

  // P: 옷 입히기 창 열고 닫기
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!isShortcutKey(event, "KeyP")) return;
    event.preventDefault();
    flashButton(openButtonRef.current);
    if (open) close();
    else openWardrobe();
  });
  useEffect(() => {
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  return (
    // z-10: 열린 옷 입히기 창이 아래 효과음 버튼 위에 그려지게
    <div className="relative z-10 flex justify-end">
      <button
        ref={openButtonRef}
        type="button"
        onClick={openWardrobe}
        aria-label="카피바라 옷 입히기"
        aria-expanded={open}
        aria-keyshortcuts="P"
        // 크기는 오른쪽 아래 앉기·때리기 버튼(모바일 size-14, md 이상 size-18)과 같게
        className="group relative block size-14 md:size-18 rounded-full focus-visible:outline-2 focus-visible:outline-primary"
      >
        {/* 나무 테·펠트 판까지 그려진 옷걸이 버튼 그림 (가방 버튼과 같은 방식) */}
        <NextImage src={WARDROBE_BUTTON_SRC} alt="" width={256} height={256} unoptimized draggable={false} className="size-full drop-shadow-md" />
        {/* 마우스를 올리거나 키보드 포커스면 나무 테 안쪽 판 위에 옷 아이콘 */}
        <span
          aria-hidden
          className="absolute inset-[16%] flex items-center justify-center rounded-full bg-overlay text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 group-data-flash:opacity-100 motion-reduce:transition-none"
        >
          <Shirt className="size-6 md:size-7" />
        </span>
      </button>

      <section
        role="dialog"
        aria-label="카피바라 옷 입히기"
        inert={!open}
        className={cn(
          "absolute right-0 top-0 flex max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-2rem))] origin-top-right flex-col gap-3 overflow-y-auto overscroll-contain rounded-2xl bg-card/95 p-4 shadow-lg backdrop-blur transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-[0.15] opacity-0",
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-title-3 font-bold text-text-strong">옷 입히기</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="닫기"
            className="flex size-10 items-center justify-center rounded-full text-title-3 text-text-caption hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
          >
            ×
          </button>
        </div>

        {/* 키 큰 모자가 머리 위로 삐져나오는 만큼 위를 비워 둔다 */}
        <div className="relative mx-auto mt-10 aspect-square w-full max-w-56">
          <OutfitPreview outfit={outfit} />
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
    </div>
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
