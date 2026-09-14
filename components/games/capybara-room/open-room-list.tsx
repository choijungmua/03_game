"use client";

import { Button } from "@/components/inputs/button";
import type { RoomState } from "@/lib/games/rooms";
import { type RoomHandle, useOpenRooms } from "@/lib/games/use-room";

/** 온라인 대전 시작 화면의 참가할 수 있는 방 목록. 누르면 그 방에 들어간다 */
export function OpenRoomList({ room }: { room: Pick<RoomHandle<RoomState>, "slug" | "pending" | "join"> }) {
  const openRooms = useOpenRooms(room.slug);

  return (
    <section aria-labelledby="open-rooms" className="flex flex-col gap-2">
      <h2 id="open-rooms" className="text-caption-1 font-semibold text-text-caption">
        참가할 수 있는 방
      </h2>
      {openRooms.length === 0 ? (
        <p className="py-6 text-center text-caption-1 text-text-caption">기다리는 방이 없어요. 방을 만들어 보세요</p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto overscroll-contain">
          {openRooms.map(({ code }) => (
            <li key={code}>
              <Button
                type="button"
                variant="outline"
                disabled={room.pending}
                onClick={() => room.join(code)}
                className="h-12 w-full justify-between"
              >
                <span>
                  방{" "}
                  <strong translate="no" className="tracking-widest">
                    {code}
                  </strong>
                </span>
                <span>참가</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
