"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib";
import { recordGameShare } from "@/lib/games/supabase";

import type { ShareButtonProps } from "./type";

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

/** 지금 보고 있는 게임(/games/<slug>)의 공유 수를 올린다. 게임 페이지가 아니면 무시 */
function recordShare(method: Parameters<typeof recordGameShare>[1]) {
  const slug = window.location.pathname.match(/^\/games\/([^/]+)/)?.[1];
  if (slug) void recordGameShare(slug, method);
}

export function ShareButton({ title, text, url: shareUrl, className }: ShareButtonProps) {
  async function share() {
    const url = shareUrl ?? window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        recordShare("native");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      recordShare("clipboard");
      toast.success("링크를 복사했어요");
    } catch {
      toast.error("공유하지 못했어요. 주소창의 링크를 직접 복사해 주세요");
    }
  }

  return (
    <button
      type="button"
      aria-label="공유하기"
      onPointerDown={stopPropagation}
      onClick={(event) => {
        event.stopPropagation();
        void share();
      }}
      className={cn(
        "inline-flex size-11 cursor-pointer items-center justify-center rounded-full bg-current/10 transition-colors hover:bg-current/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
        className,
      )}
    >
      <Share2 aria-hidden="true" className="size-5" />
    </button>
  );
}
