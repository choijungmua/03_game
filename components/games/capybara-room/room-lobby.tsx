"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { Button } from "@/components/inputs/button";
import { cn } from "@/lib";
import { GAME_SOUNDS } from "@/lib/games/constants";
import type { RoomState } from "@/lib/games/rooms";
import type { RoomHandle } from "@/lib/games/use-room";
import { playGameSound } from "@/lib/lobby/settings";

import { BotPicker } from "./bot-picker";
import { RoomList } from "./room-list";
import { type RecordSummary, RoomRecordPanel } from "./room-record";

const CARD = "rounded-2xl bg-background/85 shadow-lg backdrop-blur";
const CAPYBARA_IMAGE = "/assets/images/games/capybara-board/stone-black.webp";

interface RoomLobbyProps {
  title: string;
  /** 제목 아래 규칙 한두 줄 */
  guide: ReactNode;
  room: Pick<RoomHandle<RoomState>, "slug" | "pending" | "join" | "create" | "error" | "spectateCode" | "watch">;
  record: RecordSummary;
}

/** 버튼 누름 소리를 내고 할 일을 한다 */
function tap(action: () => void) {
  playGameSound(GAME_SOUNDS.tap);
  action();
}

/**
 * 온라인 대전 시작 화면 (알까기·바둑·오목 공용).
 * 넓은 화면: 왼쪽 소개·내 전적 | 오른쪽 방 목록(맨 위 컴터랑 두기) + 바로 아래 방 만들기.
 * 좁은 화면: 소개 → 방 목록·방 만들기 → 내 전적 순으로 쌓고 스크롤한다
 */
export function RoomLobby({ title, guide, room, record }: RoomLobbyProps) {
  const { pending, create, error, spectateCode, watch } = room;

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pt-[calc(max(1rem,env(safe-area-inset-top))_+_3.5rem)] pb-[max(1rem,env(safe-area-inset-bottom))] lg:flex lg:items-center lg:justify-center lg:overflow-hidden">
      {/* 넓은 화면: 왼쪽 소개 카드가 남는 높이를 채워 왼쪽(소개+전적)과 오른쪽(방 목록+방 만들기)의 위·아래 끝이 맞는다 */}
      <div className="mx-auto grid w-full max-w-md gap-4 lg:mx-0 lg:h-[min(38rem,100%)] lg:max-w-4xl lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-6">
        <div className={cn(CARD, "flex flex-col items-center justify-center gap-3 p-6 text-center lg:p-8")}>
          <Image
            src={CAPYBARA_IMAGE}
            alt=""
            width={96}
            height={96}
            priority
            draggable={false}
            className="size-16 drop-shadow-md lg:size-24"
          />
          <p aria-hidden="true" className="text-title-1 font-black">
            {title}
          </p>
          <p className="text-balance text-caption-1 text-text-caption">{guide}</p>
        </div>

        <div className="flex min-h-0 flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <RoomList
            room={room}
            top={<BotPicker pending={pending} onPick={(level) => tap(() => create(level))} />}
            className="min-h-80 flex-1 max-lg:max-h-[32rem]"
          />
          <Button
            type="button"
            onClick={() => tap(() => create())}
            disabled={pending}
            className="h-14 w-full shrink-0 text-title-3 font-bold shadow-lg"
          >
            방 만들기
          </Button>
          {error && (
            <p role="alert" className={cn(CARD, "px-3 py-2 text-center text-caption-1 text-error")}>
              {error}
            </p>
          )}
          {spectateCode && (
            <Button type="button" variant="outline" onClick={() => tap(watch)} className="h-12 w-full shrink-0">
              관전하기
            </Button>
          )}
        </div>

        <RoomRecordPanel title={title} summary={record} className="lg:col-start-1 lg:row-start-2" />
      </div>
    </div>
  );
}
