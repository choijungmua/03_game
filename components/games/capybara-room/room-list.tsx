"use client";

import Image from "next/image";

import { Badge } from "@/components/display/badge";
import { cn } from "@/lib";
import type { RoomState } from "@/lib/games/rooms";
import { type RoomHandle, useRoomList } from "@/lib/games/use-room";

import { NO_ROOM_IMAGE, ROOM_STATUS } from "./constants";

interface RoomListProps {
  room: Pick<RoomHandle<RoomState>, "slug" | "pending" | "join">;
  className?: string;
}

/** 온라인 대전 시작 화면 오른쪽 방 목록. 기다리는 방은 눌러서 들어가고, 게임 중인 방은 상태만 보인다 */
export function RoomList({ room, className }: RoomListProps) {
  const rooms = useRoomList(room.slug);

  return (
    <section
      aria-labelledby="room-list"
      className={cn("flex min-h-0 flex-col gap-3 rounded-2xl bg-background/85 p-4 shadow-lg backdrop-blur", className)}
    >
      <h2 id="room-list" className="flex items-baseline justify-between text-title-3 font-bold">
        방 목록
        <span className="text-caption-1 font-normal text-text-caption tabular-nums">{rooms.length}개</span>
      </h2>

      {rooms.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-2 py-8 text-center">
          <Image src={NO_ROOM_IMAGE} alt="" width={160} height={160} draggable={false} className="size-36" />
          <p className="text-base font-medium text-text-normal">열린 방이 없어요</p>
          <p className="-mt-2 text-caption-1 text-text-caption">방을 만들어 보세요</p>
        </div>
      ) : (
        <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-1">
          {rooms.map(({ code, status }) => {
            const { label, seats, variant } = ROOM_STATUS[status];
            const full = status === "playing";
            return (
              <li key={code}>
                <button
                  type="button"
                  disabled={full || room.pending}
                  onClick={() => room.join(code)}
                  aria-label={`방 ${code}, ${label} ${seats}${full ? "" : ", 참가"}`}
                  className="flex w-full items-start gap-3 rounded-xl border border-border-default bg-card p-3 text-left transition-colors hover:enabled:bg-bg-neutral focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default"
                >
                  <Image
                    src="/assets/images/games/capybara-board/stone-black.webp"
                    alt=""
                    width={48}
                    height={48}
                    draggable={false}
                    className={cn("size-12 shrink-0", full && "opacity-60 grayscale")}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <strong translate="no" className="truncate tracking-widest text-text-strong">
                      {code}
                    </strong>
                    <span className="flex items-center gap-2 text-caption-2 text-text-caption tabular-nums">
                      <Badge variant={variant} size="sm" className="cursor-[inherit]">
                        {label}
                      </Badge>
                      {seats}
                    </span>
                  </span>
                  {!full && (
                    <span aria-hidden="true" className="self-center text-caption-1 font-semibold text-primary">
                      참가
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
