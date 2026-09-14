"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { Progress } from "@/components/feedback/progress";
import { Button } from "@/components/inputs/button";
import { Input } from "@/components/inputs/input";
import { Dialog } from "@/components/overlay/dialog";
import { cn } from "@/lib";
import type { Cell, RoomView, Stone } from "@/lib/games/rooms";

import { EmoteBubble, EmotePicker, useEmoteShowing } from "./capybara-emotes";
import type { BoardRoomState, CapybaraRoomProps } from "./type";

const ASSET = "/assets/images/games/capybara-board";
const CARD = "rounded-2xl bg-background/85 shadow-lg backdrop-blur";
// 판 이미지 가장자리 테두리 안쪽에 줄이 오도록 둔 여백
const BOARD_INSET = "3.5%";
const URGENT_SECONDS = 10;

function describeStatus(view: RoomView<BoardRoomState>, stoneName: Record<Stone, string>) {
  const { state, joined, you } = view;
  if (!joined.white) return "친구가 들어오길 기다리는 중…";
  if (state.endReason) {
    if (!state.winner) return "무승부";
    if (!you) return `${stoneName[state.winner]} 승리`;
    return state.winner === you ? "이겼다!" : "졌다…";
  }
  if (!you) return `관전 중 · ${stoneName[state.turn]} 차례`;
  return state.turn === you ? `내 차례예요 (${stoneName[you]})` : "상대 차례예요";
}

function cellLabel(index: number, size: number, cell: Cell, stoneName: Record<Stone, string>) {
  const position = `${Math.floor(index / size) + 1}행 ${(index % size) + 1}열`;
  return `${position} ${cell ? stoneName[cell] : "빈 자리"}`;
}

interface TurnTimerProps {
  startedAt: number;
  limitMs: number;
  clockOffset: number;
  label: string;
}

export function TurnTimer({ startedAt, limitMs, clockOffset, label }: TurnTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, startedAt + limitMs - (now + clockOffset));
  const seconds = Math.ceil(remaining / 1000);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-caption-1">
        <span className="text-text-caption">{label}</span>
        <span className={cn("font-bold tabular-nums", seconds <= URGENT_SECONDS ? "text-error" : "text-text-strong")}>
          {seconds}초
        </span>
      </div>
      <Progress value={(remaining / limitMs) * 100} aria-label={label} aria-valuetext={`${seconds}초 남음`} />
    </div>
  );
}

/** 초대 코드 온라인 대전 + 카피바라 돌·나무 판 공용 화면 (카피바라 바둑, 카피바라 오목) */
export function CapybaraRoom<S extends BoardRoomState>({
  title,
  guide,
  room,
  starPoints,
  highlight = [],
  turnTimeMs,
  stoneName,
  onPlay,
  onResign,
  onPass,
  info,
  resultText,
  adPlacement,
}: CapybaraRoomProps<S>) {
  const { view, error, pending, copied, clockOffset, create, join, sendEmote, copyInvite, leave } = room;
  const [codeInput, setCodeInput] = useState("");
  const emoteShowing = useEmoteShowing(view?.emote ?? null);

  function handleJoinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    join(codeInput);
  }

  const state = view?.state;
  const isOver = Boolean(state?.endReason);
  // 누구 차례인지로 판을 막지 않는다 — 내 화면의 차례 정보는 폴링 간격만큼 늦을 수 있어서, 막으면 상대가 둔 직후 클릭이 씹힌다.
  // 차례 확인은 room.act가 보내기 전에 서버 기준으로 다시 한다
  const canTouch = Boolean(view && state && view.you && view.joined.white && !state.endReason);

  return (
    <div className="relative h-dvh w-full touch-manipulation select-none overflow-hidden bg-background text-text-strong [-webkit-tap-highlight-color:transparent]">
      <h1 className="sr-only">{title}</h1>

      <Image
        src={`${ASSET}/background-landscape.webp`}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        draggable={false}
        className="pointer-events-none object-cover portrait:hidden"
      />
      <Image
        src={`${ASSET}/background-portrait.webp`}
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        draggable={false}
        className="pointer-events-none object-cover landscape:hidden"
      />

      {!view || !state ? (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className={cn(CARD, "flex w-full max-w-md flex-col gap-5 p-6")}>
            <div className="flex flex-col items-center gap-2">
              <p aria-hidden="true" className="text-center text-title-1 font-black">
                {title}
              </p>
              <p className="text-center text-caption-1 text-text-caption">{guide}</p>
            </div>

            <Button type="button" onClick={create} disabled={pending} className="h-12 w-full text-title-3 font-bold">
              방 만들고 초대하기
            </Button>

            <form onSubmit={handleJoinSubmit} className="flex w-full gap-2">
              <Input
                name="invite-code"
                aria-label="초대 코드"
                placeholder="초대 코드 6자리…"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={6}
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
                className="h-12 text-base tracking-widest"
              />
              <Button type="submit" variant="outline" disabled={pending} className="h-12 shrink-0">
                참가
              </Button>
            </form>

            {error && (
              <p role="alert" className="text-center text-caption-1 text-error">
                {error}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center gap-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* 위·아래 영역은 높이를 고정한다 — 안의 내용(초대 버튼↔남은 시간, 에러, 버튼 줄)이 바뀌어도 판 크기와 위치가 그대로다 */}
          <div className="relative z-10 w-full shrink-0 px-4">
            <div className={cn(CARD, "relative mx-auto flex w-full max-w-md flex-col gap-2 px-4 py-3")}>
              <p aria-live="polite" className="truncate text-center text-title-3 font-bold">
                {describeStatus(view, stoneName)}
              </p>
              <div className="flex items-center justify-between gap-x-3 whitespace-nowrap text-caption-1 text-text-caption tabular-nums">
                <span className="shrink-0">
                  방 코드{" "}
                  <strong translate="no" className="tracking-widest text-text-strong">
                    {view.code}
                  </strong>
                </span>
                <span className="min-w-0 truncate">{info}</span>
              </div>
              {/* 친구가 들어오기 전엔 초대 버튼, 들어온 뒤엔 남은 시간이 같은 자리에 나온다 */}
              <div className="flex h-10 flex-col justify-center">
                {!view.joined.white ? (
                  <Button type="button" variant="outline" onClick={copyInvite} className="h-10 w-full">
                    {copied ? "초대 링크를 복사했어요" : "초대 링크 복사"}
                  </Button>
                ) : (
                  state.turnStartedAt !== null &&
                  !state.endReason && (
                    <TurnTimer
                      key={state.turnStartedAt}
                      startedAt={state.turnStartedAt}
                      limitMs={turnTimeMs}
                      clockOffset={clockOffset}
                      label={`${stoneName[state.turn]} 남은 시간`}
                    />
                  )
                )}
              </div>
              {/* 에러는 줄을 늘리지 않고 카드 아래(판 위)에 띄운다 */}
              {error && (
                <p
                  role="alert"
                  className="absolute inset-x-0 top-full mt-2 rounded-xl bg-background/90 px-3 py-2 text-center text-caption-1 text-error shadow-lg backdrop-blur"
                >
                  {error}
                </p>
              )}
            </div>
          </div>

          <EmoteBubble emote={view.emote} showing={emoteShowing} you={view.you} stoneName={stoneName} />

          {/* 남은 공간에 들어가는 가장 큰 정사각형 판 */}
          <div className="flex min-h-0 w-full flex-1 items-center justify-center px-1 [container-type:size]">
            <div className="relative size-[min(100cqw,100cqh)]">
              <Image
                src={`${ASSET}/board.webp`}
                alt=""
                aria-hidden="true"
                fill
                priority
                sizes="(orientation: portrait) 100vw, 80vh"
                draggable={false}
                className="pointer-events-none drop-shadow-lg"
              />
              <div
                className="absolute grid"
                style={{ inset: BOARD_INSET, gridTemplateColumns: `repeat(${state.size}, minmax(0, 1fr))` }}
              >
                {/* 칸 가운데를 지나는 줄. 칸(버튼)과 같은 좌표계라 누르는 자리와 교차점이 어긋나지 않는다 */}
                <svg
                  aria-hidden="true"
                  viewBox={`0 0 ${state.size} ${state.size}`}
                  className="pointer-events-none absolute inset-0 size-full text-neutral-900/70"
                >
                  {Array.from({ length: state.size }, (_, i) => (
                    <g key={i} stroke="currentColor">
                      <line x1={0.5} y1={i + 0.5} x2={state.size - 0.5} y2={i + 0.5} vectorEffect="non-scaling-stroke" />
                      <line x1={i + 0.5} y1={0.5} x2={i + 0.5} y2={state.size - 0.5} vectorEffect="non-scaling-stroke" />
                    </g>
                  ))}
                  {starPoints.map((index) => (
                    <circle
                      key={index}
                      cx={(index % state.size) + 0.5}
                      cy={Math.floor(index / state.size) + 0.5}
                      r={0.08}
                      fill="currentColor"
                    />
                  ))}
                </svg>

                {state.board.map((cell, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={cellLabel(index, state.size, cell, stoneName)}
                    disabled={!canTouch || cell !== null || pending}
                    onClick={() => onPlay(index)}
                    className="relative flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {cell && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "pointer-events-none relative size-full rounded-full",
                          state.lastMove === index && "ring-2 ring-primary",
                          highlight.includes(index) && "ring-3 ring-warning motion-safe:animate-pulse",
                        )}
                      >
                        <Image
                          src={`${ASSET}/stone-${cell}.webp`}
                          alt=""
                          fill
                          sizes="12vmin"
                          draggable={false}
                          // 돌 이미지에 투명 여백이 있어 칸에 꽉 차 보이도록 키운다
                          className="pointer-events-none scale-[1.2]"
                        />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 대국 중이 아닐 때도 자리는 차지하고 보이지만 않게 한다 (나타났다 사라지면 판 크기가 바뀐다) */}
          <div className={cn("w-full shrink-0 px-4", !(view.you && view.joined.white && !state.endReason) && "invisible")}>
              <div className={cn(CARD, "relative mx-auto flex w-full max-w-md gap-2 p-2")}>
                <EmotePicker onSend={sendEmote} disabled={!canTouch || emoteShowing} />
                {onPass && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canTouch || pending}
                    onClick={onPass}
                    className="h-11 flex-1"
                  >
                    패스
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => window.confirm("정말 기권할까요?") && onResign()}
                  className="h-11 flex-1"
                >
                  기권…
                </Button>
              </div>
          </div>
        </div>
      )}

      <Dialog open={isOver} onOpenChange={(open) => !open && leave()}>
        <Dialog.Content showCloseButton={false} closeOnOverlayClick={false} className="text-center">
          {view && state?.endReason && (
            <div className="flex flex-col items-center gap-3">
              {state.winner && (
                <Image
                  src={`${ASSET}/stone-${state.winner}.webp`}
                  alt={stoneName[state.winner]}
                  width={256}
                  height={256}
                  className="size-24"
                />
              )}
              <Dialog.Title className="text-title-1 font-black">{describeStatus(view, stoneName)}</Dialog.Title>
              <Dialog.Description className="tabular-nums">{resultText}</Dialog.Description>
            </div>
          )}

          <Button type="button" onClick={leave} className="h-12 w-full text-title-3 font-bold">
            처음으로
          </Button>

          <div className="mt-6">
            <AdSlot placement={adPlacement} />
          </div>
        </Dialog.Content>
      </Dialog>
    </div>
  );
}
