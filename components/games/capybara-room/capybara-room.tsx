"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { Progress } from "@/components/feedback/progress";
import { GameControls, LEAVE_CONFIRM_MESSAGE } from "@/components/games/game-controls";
import { Button, buttonVariants } from "@/components/inputs/button";
import { LobbyLink } from "@/components/navigation/lobby-link";
import { Dialog } from "@/components/overlay/dialog";
import { cn } from "@/lib";
import { FULL_BLEED_LAYER, GAME_SOUNDS } from "@/lib/games/constants";
import type { Cell, RoomView, Stone } from "@/lib/games/rooms";
import { useLockPageScroll } from "@/lib/games/use-lock-page-scroll";
import { playGameSound } from "@/lib/lobby/settings";

import { EmoteBubble, EmotePicker, useEmoteShowing } from "./capybara-emotes";
import { ROOM_SOUNDS, TICK_SECONDS, URGENT_SECONDS } from "./constants";
import { RoomLobby } from "./room-lobby";
import { useRoomRecord } from "./room-record";
import type { BoardRoomState, CapybaraRoomProps } from "./type";

const ASSET = "/assets/images/games/capybara-board";
const CARD = "rounded-2xl bg-background/85 shadow-lg backdrop-blur";
// 판 이미지 가장자리 테두리 안쪽에 줄이 오도록 둔 여백
const BOARD_INSET = "3.5%";

function describeStatus(view: RoomView<BoardRoomState>, stoneName: Record<Stone, string>) {
  const { state, joined, you } = view;
  if (!joined.white) return "친구가 들어오길 기다리는 중…";
  if (state.endReason) {
    if (!state.winner) return "무승부";
    if (!you) return `${stoneName[state.winner]} 승리`;
    return state.winner === you ? "이겼다!" : "졌다…";
  }
  if (!you) return `관전 중 · ${stoneName[state.turn]} 차례`;
  if (state.turn === you) return `내 차례예요 (${stoneName[you]})`;
  return view.bot ? "컴퓨터가 생각하는 중…" : "상대 차례예요";
}

/** 버튼 누름 소리를 내고 할 일을 한다 */
function tap(action: () => void) {
  playGameSound(GAME_SOUNDS.tap);
  action();
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
  /** 내 차례인지. false면 경고음·초읽기를 내지 않는다 (모르면 넘기지 않는다) */
  mine?: boolean;
}

export function TurnTimer({ startedAt, limitMs, clockOffset, label, mine }: TurnTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  /** 마지막으로 소리를 낸 남은 초. 차례가 바뀌면 key로 새로 그려져 처음부터 센다 */
  const sounded = useRef(Infinity);

  // 10초 남으면 삐삐 한 번, 마지막 5초는 초마다 틱
  const countDown = useEffectEvent((current: number) => {
    const left = Math.ceil(Math.max(0, startedAt + limitMs - (current + clockOffset)) / 1000);
    if (mine === false || left < 1 || left > URGENT_SECONDS || left >= sounded.current) return;
    const warned = sounded.current <= URGENT_SECONDS;
    sounded.current = left;
    if (left <= TICK_SECONDS) playGameSound(GAME_SOUNDS.tick);
    else if (!warned) playGameSound(GAME_SOUNDS.warning);
  });

  useEffect(() => {
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      countDown(current);
    }, 250);
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
  const { view, error, pending, reconnecting, gone, copied, clockOffset, sendEmote, copyInvite, leave } = room;
  const emoteShowing = useEmoteShowing(view?.emote ?? null);
  const record = useRoomRecord(room.slug, view);

  const state = view?.state;
  const isOver = Boolean(state?.endReason);
  // 누구 차례인지로 판을 막지 않는다 — 내 화면의 차례 정보는 폴링 간격만큼 늦을 수 있어서, 막으면 상대가 둔 직후 클릭이 씹힌다.
  // 차례 확인은 room.act가 보내기 전에 서버 기준으로 다시 한다
  // 서버와 연결이 끊긴 동안에는 눌러도 보내지 못하니 막는다
  const canTouch = Boolean(view && state && view.you && view.joined.white && !state.endReason && !reconnecting);

  // 서버에서 온 변화는 값이 바뀐 순간에만 한 번 울린다 (다시 그려지거나 이펙트가 다시 돌아도 같은 값이면 조용하다)
  const code = view?.code ?? null;
  const opponentIn = Boolean(view?.joined.white);
  const playing = Boolean(view?.you && opponentIn && !state?.endReason);
  useLockPageScroll(playing);
  const heard = useRef({ code, opponentIn, error, copied, reconnecting, gone });
  useEffect(() => {
    const before = heard.current;
    heard.current = { code, opponentIn, error, copied, reconnecting, gone };
    // 기다리던 방에 상대가 들어옴 / 상대가 이미 있는 방(참가·컴퓨터 대전)에 들어가 바로 시작
    if (code && code === before.code && opponentIn && !before.opponentIn) playGameSound(ROOM_SOUNDS.opponentJoined);
    else if (code && code !== before.code && playing) playGameSound(GAME_SOUNDS.start);
    if (gone && !before.gone) playGameSound(ROOM_SOUNDS.gone);
    else if (error && error !== before.error) playGameSound(GAME_SOUNDS.wrong);
    else if (before.reconnecting && !reconnecting && !gone) playGameSound(ROOM_SOUNDS.reconnected);
    if (copied && !before.copied) playGameSound(ROOM_SOUNDS.copied);
  }, [code, opponentIn, playing, error, copied, reconnecting, gone]);

  return (
    <div className="relative h-dvh w-full touch-manipulation select-none overflow-hidden bg-background text-text-strong [-webkit-tap-highlight-color:transparent]">
      <h1 className="sr-only">{title}</h1>

      {/* 배경 그림은 툴바·홈 인디케이터 뒤까지 깐다 */}
      <div aria-hidden="true" className={FULL_BLEED_LAYER}>
        <Image
          src={`${ASSET}/background-landscape.webp`}
          alt=""
          fill
          priority
          sizes="100vw"
          draggable={false}
          className="object-cover portrait:hidden"
        />
        <Image
          src={`${ASSET}/background-portrait.webp`}
          alt=""
          fill
          priority
          sizes="100vw"
          draggable={false}
          className="object-cover landscape:hidden"
        />
      </div>

      {!view || !state ? (
        <RoomLobby title={title} guide={guide} room={room} record={record} />
      ) : (
        // 좁은 화면은 카드가 가로를 꽉 채워 왼쪽 위 뒤로·효과음 버튼 두 개 아래에서 시작한다 (넓으면 카드가 가운데라 안 겹친다)
        <div className="absolute inset-0 flex flex-col items-center gap-3 pt-[calc(max(1rem,env(safe-area-inset-top))_+_3.5rem)] pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:pt-[calc(max(1rem,env(safe-area-inset-top))_+_7rem)]">
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
                  <Button type="button" variant="outline" onClick={() => tap(copyInvite)} className="h-10 w-full">
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
                      mine={state.turn === view.you}
                    />
                  )
                )}
              </div>
              {/* 에러는 줄을 늘리지 않고 카드 아래(판 위)에 띄운다. 판 윗줄을 덮으므로 누른 건 아래 판으로 지나가게 한다 */}
              {error && (
                <p
                  role="alert"
                  className="pointer-events-none absolute inset-x-0 top-full mt-2 rounded-xl bg-background/90 px-3 py-2 text-center text-caption-1 text-error shadow-lg backdrop-blur"
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
                    onClick={() => tap(onPass)}
                    className="h-11 flex-1"
                  >
                    패스
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || reconnecting}
                  onClick={() => tap(() => window.confirm("정말 기권할까요?") && onResign())}
                  className="h-11 flex-1"
                >
                  기권…
                </Button>
              </div>
          </div>
        </div>
      )}

      <GameControls
        leaveConfirm={view?.you && view.joined.white && !state?.endReason ? LEAVE_CONFIRM_MESSAGE : undefined}
      />

      <Dialog open={isOver || gone} onOpenChange={(open) => !open && leave()}>
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
          {gone && !state?.endReason && (
            <div className="flex flex-col items-center gap-3">
              <Dialog.Title className="text-title-1 font-black">방이 사라졌어요</Dialog.Title>
              <Dialog.Description>
                오래 비어 있어 방이 정리됐거나 서버에서 방을 찾을 수 없어요. 처음 화면에서 새로 시작해 주세요.
              </Dialog.Description>
            </div>
          )}

          <Button type="button" onClick={() => tap(leave)} className="h-12 w-full text-title-3 font-bold">
            처음으로
          </Button>
          {/* 창이 화면을 덮어 왼쪽 위 뒤로 버튼을 누를 수 없으니 창 안에서도 나갈 수 있게 한다 */}
          <LobbyLink className={cn(buttonVariants({ variant: "ghost" }), "h-12 w-full")}>로비로</LobbyLink>

          <div className="mt-6">
            <AdSlot placement={adPlacement} />
          </div>
        </Dialog.Content>
      </Dialog>
    </div>
  );
}
