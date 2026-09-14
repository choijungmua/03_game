"use client";

import { useEffect, useEffectEvent } from "react";

import { ShareButton } from "@/components/games/share-button";
import { cn } from "@/lib";
import { createLocalRecordStore, type RecordGuard } from "@/lib/games/local-records";
import type { RoomView } from "@/lib/games/rooms";

import { RECORD_LIMIT } from "./constants";
import type { BoardRoomState } from "./type";

export type RoomOutcome = "win" | "loss" | "draw";

export interface RoomRecord {
  code: string;
  result: RoomOutcome;
  at: number;
}

/** 결과를 셀 수 있는 방 모양 — 판 게임(바둑·오목)과 알까기가 모두 이 필드를 가진다 */
export type RecordableView = Pick<RoomView<Pick<BoardRoomState, "endReason" | "winner">>, "code" | "you" | "state">;

const isRoomRecord: RecordGuard<RoomRecord> = (value): value is RoomRecord =>
  typeof value?.code === "string" &&
  typeof value.at === "number" &&
  (value.result === "win" || value.result === "loss" || value.result === "draw");

const stores = new Map<string, ReturnType<typeof createLocalRecordStore<RoomRecord>>>();

function storeOf(slug: string) {
  let store = stores.get(slug);
  if (!store) {
    store = createLocalRecordStore(`${slug}:room-records`, isRoomRecord);
    stores.set(slug, store);
  }
  return store;
}

/** 끝난 판을 기록에 더한 새 목록. 관전·진행 중이거나 이미 센 방이면 null */
export function addRoomResult(records: readonly RoomRecord[], view: RecordableView | null, now: number) {
  if (!view?.you || !view.state.endReason || records.some((record) => record.code === view.code)) return null;
  const { winner } = view.state;
  const result: RoomOutcome = !winner ? "draw" : winner === view.you ? "win" : "loss";
  return [...records, { code: view.code, result, at: now }].slice(-RECORD_LIMIT);
}

export function summarizeRecords(records: readonly RoomRecord[]) {
  const count = (result: RoomOutcome) => records.filter((record) => record.result === result).length;
  return { wins: count("win"), losses: count("loss"), draws: count("draw") };
}

export type RecordSummary = ReturnType<typeof summarizeRecords>;

/** 판이 끝나면 이 브라우저의 전적에 한 번 더하고, 지금까지 전적을 돌려준다 */
export function useRoomRecord(slug: string, view: RecordableView | null) {
  const { save, useRecords } = storeOf(slug);
  const records = useRecords();

  const record = useEffectEvent(() => {
    const next = addRoomResult(records, view, Date.now());
    if (next) save(next);
  });

  const code = view?.code;
  const ended = Boolean(view?.state.endReason);
  useEffect(() => {
    if (ended) record();
  }, [code, ended]);

  return summarizeRecords(records);
}

interface RoomRecordPanelProps {
  title: string;
  summary: RecordSummary;
  className?: string;
}

/** 시작 화면 왼쪽 내 전적 카드. 몇 승 몇 패인지와 공유 버튼 */
export function RoomRecordPanel({ title, summary, className }: RoomRecordPanelProps) {
  const { wins, losses, draws } = summary;
  const total = wins + losses + draws;
  const score = `${wins}승 ${losses}패${draws > 0 ? ` ${draws}무` : ""}`;

  return (
    <section
      aria-labelledby="room-record"
      className={cn("flex flex-col gap-3 rounded-2xl bg-background/85 p-5 shadow-lg backdrop-blur", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="room-record" className="text-title-3 font-bold">
          내 전적
        </h2>
        <ShareButton title={title} text={`${title} ${score}! 나랑 한 판 할래?`} />
      </div>
      <p className="text-center text-title-1 font-black tabular-nums">{score}</p>
      <p className="text-center text-caption-1 text-text-caption tabular-nums">
        {total === 0 ? "아직 둔 판이 없어요" : `${total}판 · 승률 ${Math.round((wins / total) * 100)}%`}
      </p>
    </section>
  );
}
