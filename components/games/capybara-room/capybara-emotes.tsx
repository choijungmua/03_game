"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/inputs/button";
import { cn } from "@/lib";
import { GAME_SOUNDS } from "@/lib/games/constants";
import { CAPYBARA_EMOTES, EMOTE_SHOW_MS, emoteImage, type RoomEmote } from "@/lib/games/emotes";
import type { Stone } from "@/lib/games/rooms";
import { playGameSound } from "@/lib/lobby/settings";

import { ROOM_SOUNDS } from "./constants";

const PAGE_SIZE = 8;
const PAGE_COUNT = Math.ceil(CAPYBARA_EMOTES.length / PAGE_SIZE);

/** 마지막 이모티콘이 아직 화면에 떠 있는지. 떠 있는 동안 말풍선을 보이고 놀리기 버튼을 막는다 */
export function useEmoteShowing(emote: RoomEmote | null) {
  const [doneAt, setDoneAt] = useState<number | null>(null);
  const at = emote?.at;
  // 처음부터 떠 있던 이모티콘은 조용히, 새로 온 이모티콘(내 것·상대 것)만 한 번 뽁
  const popped = useRef(at);

  useEffect(() => {
    if (at === undefined) return;
    if (popped.current !== at) {
      popped.current = at;
      playGameSound(ROOM_SOUNDS.emotePop);
    }
    const id = setTimeout(() => setDoneAt(at), EMOTE_SHOW_MS);
    return () => clearTimeout(id);
  }, [at]);

  return at !== undefined && doneAt !== at;
}

/** 이모티콘을 판 위에 띄운다. 입력을 막지 않게 pointer-events-none */
export function EmoteBubble({
  emote,
  showing,
  you,
  stoneName,
}: {
  emote: RoomEmote | null;
  showing: boolean;
  you: Stone | null;
  stoneName: Record<Stone, string>;
}) {
  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-1/3 z-20 flex justify-center px-4">
      {emote && showing && (
        <div
          key={emote.at}
          className="flex items-center gap-2 rounded-2xl bg-background/90 py-2 pr-4 pl-2 shadow-lg backdrop-blur motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-50 motion-safe:duration-300"
        >
          <Image src={emoteImage(emote.id)} alt="" width={96} height={96} unoptimized draggable={false} className="size-24" />
          <p className="min-w-0 text-title-3 font-bold break-words">
            <span className="sr-only">{emote.seat === you ? "나" : stoneName[emote.seat]}: </span>
            {CAPYBARA_EMOTES[emote.id]}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * 놀리기 버튼 + 한 페이지 8개씩 보여주는 이모티콘 판. 다음 버튼으로 넘긴다.
 * 판은 가장 가까운 relative 조상(버튼 줄 카드) 폭에 맞춰 위로 뜬다
 */
export function EmotePicker({ onSend, disabled }: { onSend(id: number): void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const start = page * PAGE_SIZE;

  return (
    <>
      {open && !disabled && (
        <div className="absolute inset-x-0 bottom-full z-20 mb-3 flex flex-col gap-2 rounded-2xl bg-background/95 p-2 shadow-lg backdrop-blur">
          <div className="grid grid-cols-4 gap-1">
            {CAPYBARA_EMOTES.slice(start, start + PAGE_SIZE).map((text, offset) => (
              <button
                key={start + offset}
                type="button"
                aria-label={text}
                onClick={() => {
                  playGameSound(ROOM_SOUNDS.emoteSend);
                  onSend(start + offset);
                  setOpen(false);
                }}
                className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl p-1 hover:bg-card focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Image
                  src={emoteImage(start + offset)}
                  alt=""
                  width={56}
                  height={56}
                  unoptimized
                  draggable={false}
                  className="size-14"
                />
                <span aria-hidden="true" className="line-clamp-2 text-center text-caption-3 text-text-caption">
                  {text}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-caption-1 text-text-caption tabular-nums">
              {page + 1} / {PAGE_COUNT}
            </span>
            <Button type="button" variant="outline" onClick={() => {
                playGameSound(GAME_SOUNDS.tap);
                setPage((page + 1) % PAGE_COUNT);
              }} className="h-10">
              다음
            </Button>
          </div>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        aria-expanded={open && !disabled}
        disabled={disabled}
        onClick={() => {
          playGameSound(GAME_SOUNDS.tap);
          setOpen(!open);
        }}
        className={cn("h-11 flex-1 shrink-0", open && !disabled && "border-primary")}
      >
        놀리기
      </Button>
    </>
  );
}
