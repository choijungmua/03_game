"use client";

import { Crown } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { Progress } from "@/components/feedback/progress";
import { EmoteBubble, EmotePicker, OpenRoomList, TurnTimer, useEmoteShowing } from "@/components/games/capybara-room";
import { GameControls, LEAVE_CONFIRM_MESSAGE } from "@/components/games/game-controls";
import { Button } from "@/components/inputs/button";
import { Dialog } from "@/components/overlay/dialog";
import { cn } from "@/lib";
import { GAME_TITLES } from "@/lib/games/constants";
import { opponent, type RoomView, type Stone, type Vector } from "@/lib/games/rooms";
import { useRoom } from "@/lib/games/use-room";

import {
  type AlkkagiState,
  FIELD,
  MAX_SPEED,
  PER_SIDE,
  type Piece,
  radiusOf,
  simulateShot,
  TURN_TIME_MS,
} from "./logic";
import type { AlkkagiAction } from "./rooms";

const ASSET = "/assets/images/games/capybara-board";
const STONE_NAME: Record<Stone, string> = { black: "갈색 카피바라", white: "흰 카피바라" };
const CARD = "rounded-2xl bg-background/85 shadow-lg backdrop-blur";
// 판 이미지 가장자리 테두리 안쪽이 실제 판(여기를 넘으면 떨어짐)
const BOARD_INSET = "3.5%";
const STEP_MS = 1000 / 60;
/** 이만큼(판 좌표) 뒤로 당기면 최대 힘 */
const MAX_PULL = FIELD * 0.3;
const MIN_POWER = 0.05;
const KEY_ANGLE_STEP = Math.PI / 36;
const FLASH_MS = 1400;

interface Aim {
  pieceId: number;
  /** 판 좌표 기준 발사 방향(라디안) */
  angle: number;
  /** 0~1 */
  power: number;
}

function describeStatus(view: RoomView<AlkkagiState>, animating: boolean) {
  const { state, joined, you } = view;
  if (!joined.white) return "친구가 들어오길 기다리는 중…";
  if (animating) return "데굴데굴…";
  if (state.winner) {
    if (!you) return `${STONE_NAME[state.winner]} 승리`;
    return state.winner === you ? "이겼다!" : "졌다…";
  }
  if (!you) return `관전 중 · ${STONE_NAME[state.turn]} 차례`;
  if (state.turn !== you) return view.bot ? "컴퓨터가 조준하는 중…" : "상대가 조준하는 중…";
  return state.combo > 0 ? `한 번 더! (${state.combo}콤보)` : `내 차례예요 (${STONE_NAME[you]})`;
}

function describeEnd(state: AlkkagiState) {
  if (!state.winner) return "";
  if (state.endReason === "resign") return `${STONE_NAME[opponent(state.winner)]}가 기권했어요.`;
  if (state.endReason === "timeout") return `${STONE_NAME[opponent(state.winner)]}가 제한시간을 넘겼어요.`;
  return `${STONE_NAME[opponent(state.winner)]} 알이 모두 판 밖으로 떨어졌어요.`;
}

function aliveCount(pieces: Piece[], owner: Stone) {
  return pieces.filter((piece) => piece.owner === owner && !piece.out).length;
}

export function CapybaraAlkkagi() {
  const { view, error, pending, copied, clockOffset, create, join, act, sendEmote, copyInvite, leave } = useRoom<
    AlkkagiState,
    AlkkagiAction
  >("capybara-alkkagi");  const emoteShowing = useEmoteShowing(view?.emote ?? null);
  const [aim, setAim] = useState<Aim | null>(null);
  /** 샷 애니메이션 중 보여줄 알 위치. null이면 서버 상태 그대로 */
  const [frame, setFrame] = useState<Piece[] | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // 포인터 이벤트는 렌더링 사이에 여러 번 올 수 있어서 최신 조준값은 ref로도 들고 있는다
  const aimRef = useRef<Aim | null>(null);
  const dragPointer = useRef<number | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const seenShot = useRef<{ code: string; seq: number } | null>(null);

  function updateAim(next: Aim | null) {
    aimRef.current = next;
    setAim(next);
  }

  const state = view?.state;
  const code = view?.code;
  const shotSeq = state?.lastShot?.seq ?? 0;
  const animating = frame !== null;
  const canShoot = Boolean(
    view && state && view.joined.white && !state.winner && view.you === state.turn && !animating && !pending,
  );
  // 백은 판을 180도 돌려서 본다 — 내 알이 항상 아래쪽
  const flipped = view?.you === "white";
  const forwardAngle = flipped ? Math.PI / 2 : -Math.PI / 2;

  const showFlash = useEffectEvent((message: string) => {
    setFlash(message);
    setTimeout(() => setFlash(null), FLASH_MS);
  });

  const shake = useEffectEvent(() => {
    boardRef.current?.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: "translate(-4px, 2px)" },
        { transform: "translate(3px, -2px)" },
        { transform: "translate(0, 0)" },
      ],
      { duration: 160 },
    );
  });

  // 새 샷이 오면(내가 쳤든 상대가 쳤든) 서버와 같은 시뮬레이션을 돌려 프레임을 만들고 재생한다.
  // 방에 처음 들어왔을 때는 지난 샷을 다시 틀지 않는다
  const playNewShot = useEffectEvent(() => {
    const shot = view?.state.lastShot;
    const seen = seenShot.current;
    seenShot.current = code ? { code, seq: shotSeq } : null;
    if (!shot || !code || !seen || seen.code !== code || seen.seq >= shot.seq) return;

    const afterMessage = () => {
      if (shot.knocked === 0) return;
      const combo = view?.state.combo ?? 0;
      showFlash(combo > 0 ? `퉁! ${shot.knocked}마리 · 한 번 더!` : `퉁! ${shot.knocked}마리`);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      afterMessage();
      return;
    }

    const frames: Piece[][] = [];
    const hitFrames = new Set<number>();
    simulateShot(shot.before, shot.pieceId, shot.velocity, (pieces, hit) => {
      if (hit) hitFrames.add(frames.length);
      frames.push(pieces.map((piece) => ({ ...piece })));
    });

    const startedAt = performance.now();
    let shown = -1;
    let rafId = requestAnimationFrame(function tick(now) {
      const index = Math.min(frames.length - 1, Math.floor((now - startedAt) / STEP_MS));
      for (let i = shown + 1; i <= index; i++) {
        if (hitFrames.has(i)) {
          shake();
          break;
        }
      }
      shown = index;
      if (index >= frames.length - 1) {
        setFrame(null);
        afterMessage();
        return;
      }
      setFrame(frames[index]);
      rafId = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(rafId);
  });

  useEffect(() => {
    const cancel = playNewShot();
    return () => {
      cancel?.();
      setFrame(null);
    };
  }, [code, shotSeq]);

  function fire(target: Aim) {
    updateAim(null);
    if (target.power < MIN_POWER) return;
    const speed = target.power * MAX_SPEED;
    act("shoot", target.pieceId, { x: Math.cos(target.angle) * speed, y: Math.sin(target.angle) * speed });
  }

  function toBoardPoint(clientX: number, clientY: number): Vector | null {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((clientX - rect.left) / rect.width) * FIELD;
    const y = ((clientY - rect.top) / rect.height) * FIELD;
    return flipped ? { x: FIELD - x, y: FIELD - y } : { x, y };
  }

  // 알을 누른 채 뒤로 당겼다 놓으면 반대 방향으로 날아간다 (새총)
  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, piece: Piece) {
    if (!canShoot) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragPointer.current = event.pointerId;
    updateAim({ pieceId: piece.id, angle: forwardAngle, power: 0 });
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>, piece: Piece) {
    if (dragPointer.current !== event.pointerId) return;
    const point = toBoardPoint(event.clientX, event.clientY);
    if (!point) return;
    const pullX = piece.x - point.x;
    const pullY = piece.y - point.y;
    const distance = Math.sqrt(pullX * pullX + pullY * pullY);
    updateAim({ pieceId: piece.id, angle: Math.atan2(pullY, pullX), power: Math.min(1, distance / MAX_PULL) });
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (dragPointer.current !== event.pointerId) return;
    dragPointer.current = null;
    if (aimRef.current) fire(aimRef.current);
  }

  function handlePointerCancel() {
    dragPointer.current = null;
    updateAim(null);
  }

  // 키보드: 알에 포커스 → 좌우 방향키로 조준, 위아래로 힘, Enter/Space로 발사
  function handleFocus(piece: Piece) {
    if (dragPointer.current !== null || !canShoot || aimRef.current?.pieceId === piece.id) return;
    updateAim({ pieceId: piece.id, angle: forwardAngle, power: 0.5 });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, piece: Piece) {
    const current = aimRef.current?.pieceId === piece.id ? aimRef.current : { pieceId: piece.id, angle: forwardAngle, power: 0.5 };
    const clampPower = (power: number) => Math.min(1, Math.max(0, power));
    const handlers: Partial<Record<string, () => void>> = {
      ArrowLeft: () => updateAim({ ...current, angle: current.angle - KEY_ANGLE_STEP }),
      ArrowRight: () => updateAim({ ...current, angle: current.angle + KEY_ANGLE_STEP }),
      ArrowUp: () => updateAim({ ...current, power: clampPower(current.power + 0.1) }),
      ArrowDown: () => updateAim({ ...current, power: clampPower(current.power - 0.1) }),
      Enter: () => fire(current),
      " ": () => fire(current),
      Escape: () => updateAim(null),
    };
    const handler = handlers[event.key];
    if (!handler || !canShoot) return;
    event.preventDefault();
    handler();
  }

  const pieces = frame ?? state?.pieces ?? [];
  const toScreen = (point: Vector) => (flipped ? { x: FIELD - point.x, y: FIELD - point.y } : point);
  const aimedPiece = aim ? pieces.find((piece) => piece.id === aim.pieceId && !piece.out) : undefined;
  const isOver = Boolean(state?.endReason) && !animating;

  return (
    <div className="relative h-dvh w-full touch-manipulation select-none overflow-hidden bg-background text-text-strong [-webkit-tap-highlight-color:transparent]">
      <h1 className="sr-only">{GAME_TITLES["capybara-alkkagi"]}</h1>

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
                {GAME_TITLES["capybara-alkkagi"]}
              </p>
              <p className="text-center text-caption-1 text-text-caption">
                내 카피바라를 뒤로 당겼다 놓아서 상대 카피바라를 판 밖으로 떨어뜨려요. 왕관 쓴 대장은 크고 무거워서 잘 안 밀려요.
                한 번에 {TURN_TIME_MS / 1000}초
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button type="button" onClick={() => create()} disabled={pending} className="h-12 w-full text-title-3 font-bold">
                방 만들기
              </Button>
              <Button type="button" variant="outline" onClick={() => create(true)} disabled={pending} className="h-12 w-full text-title-3 font-bold">
                컴퓨터와 두기
              </Button>
            </div>

            <OpenRoomList room={{ slug: "capybara-alkkagi", pending, join }} />

            {error && (
              <p role="alert" className="text-center text-caption-1 text-error">
                {error}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center gap-3 pt-[calc(max(1rem,env(safe-area-inset-top))_+_3.5rem)] pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* 위·아래 영역은 높이를 고정한다 — 안의 내용(초대 버튼↔남은 시간, 에러, 버튼 줄)이 바뀌어도 판 크기와 위치가 그대로다 */}
          <div className="relative z-10 w-full shrink-0 px-4">
            <div className={cn(CARD, "relative mx-auto flex w-full max-w-md flex-col gap-2 px-4 py-3")}>
              <p aria-live="polite" className="truncate text-center text-title-3 font-bold">
                {describeStatus(view, animating)}
              </p>
              <div className="flex items-center justify-between gap-x-3 whitespace-nowrap text-caption-1 text-text-caption tabular-nums">
                <span className="shrink-0">
                  방 코드{" "}
                  <strong translate="no" className="tracking-widest text-text-strong">
                    {view.code}
                  </strong>
                </span>
                <span className="min-w-0 truncate">
                  남은 알 갈색 {aliveCount(pieces, "black")}/{PER_SIDE} · 흰 {aliveCount(pieces, "white")}/{PER_SIDE}
                </span>
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
                      limitMs={TURN_TIME_MS}
                      clockOffset={clockOffset}
                      label={`${STONE_NAME[state.turn]} 남은 시간`}
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

          <EmoteBubble emote={view.emote} showing={emoteShowing} you={view.you} stoneName={STONE_NAME} />

          {/* 남은 공간에 들어가는 가장 큰 정사각형 판 */}
          <div className="flex min-h-0 w-full flex-1 items-center justify-center px-1 [container-type:size]">
            <div ref={boardRef} className="relative size-[min(100cqw,100cqh)]">
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

              <div ref={fieldRef} className="absolute" style={{ inset: BOARD_INSET }}>
                {aim && aimedPiece && (
                  <svg
                    aria-hidden="true"
                    viewBox={`0 0 ${FIELD} ${FIELD}`}
                    className="pointer-events-none absolute inset-0 size-full overflow-visible text-warning"
                  >
                    {(() => {
                      const from = toScreen(aimedPiece);
                      const direction = flipped ? aim.angle + Math.PI : aim.angle;
                      const length = radiusOf(aimedPiece) + aim.power * MAX_PULL;
                      const to = { x: from.x + Math.cos(direction) * length, y: from.y + Math.sin(direction) * length };
                      return (
                        <>
                          <line
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            stroke="currentColor"
                            strokeWidth={8}
                            strokeLinecap="round"
                            strokeDasharray="4 18"
                          />
                          <circle cx={to.x} cy={to.y} r={12} fill="currentColor" />
                        </>
                      );
                    })()}
                  </svg>
                )}

                {pieces.map((piece) => {
                  const screen = toScreen(piece);
                  const mine = view.you === piece.owner;
                  const diameter = radiusOf(piece) * 2;
                  return (
                    <button
                      key={piece.id}
                      type="button"
                      aria-label={`${mine ? "내" : "상대"} ${piece.leader ? "대장 " : ""}${STONE_NAME[piece.owner]}${piece.out ? " (떨어짐)" : ""}`}
                      disabled={!canShoot || !mine || piece.out}
                      onPointerDown={(event) => handlePointerDown(event, piece)}
                      onPointerMove={(event) => handlePointerMove(event, piece)}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerCancel}
                      onFocus={() => handleFocus(piece)}
                      onBlur={() => dragPointer.current === null && updateAim(null)}
                      onKeyDown={(event) => handleKeyDown(event, piece)}
                      className={cn(
                        "absolute top-0 left-0 touch-none rounded-full focus-visible:outline-2 focus-visible:outline-primary",
                        piece.out && "pointer-events-none",
                        canShoot && mine && !piece.out && "cursor-grab active:cursor-grabbing",
                      )}
                      style={{
                        width: `${(diameter / FIELD) * 100}%`,
                        height: `${(diameter / FIELD) * 100}%`,
                        // 알 크기 기준 %라서 판 좌표 / 지름으로 옮기고 -50%로 가운데 맞춤
                        transform: `translate(${(screen.x / diameter) * 100 - 50}%, ${(screen.y / diameter) * 100 - 50}%)`,
                      }}
                    >
                      {/* 떨어지면 작아지면서 사라진다 */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "pointer-events-none absolute inset-0 rounded-full transition-[transform,opacity] duration-300 ease-in motion-reduce:transition-none",
                          piece.out && "scale-50 opacity-0",
                          aim?.pieceId === piece.id && "ring-3 ring-warning",
                          canShoot && mine && !piece.out && !aim && "motion-safe:animate-pulse",
                        )}
                      >
                        <Image
                          src={`${ASSET}/stone-${piece.owner}.webp`}
                          alt=""
                          fill
                          sizes="10vmin"
                          draggable={false}
                          // 돌 이미지에 투명 여백이 있어 알 크기에 꽉 차 보이도록 키운다
                          className="pointer-events-none scale-[1.2] drop-shadow-md"
                        />
                        {piece.leader && (
                          <Crown
                            aria-hidden="true"
                            strokeWidth={2.5}
                            className="absolute -top-[30%] left-1/2 size-[45%] -translate-x-1/2 fill-warning text-neutral-900 drop-shadow"
                          />
                        )}
                      </span>
                    </button>
                  );
                })}

                {flash && (
                  <p
                    aria-live="polite"
                    className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-title-1 font-black text-warning drop-shadow-lg animate-in fade-in zoom-in-50 duration-200"
                  >
                    {flash}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 대국 중이 아닐 때도 자리는 차지하고 보이지만 않게 한다 (나타났다 사라지면 판 크기가 바뀐다) */}
          <div className={cn("w-full shrink-0 px-4", !(view.you && view.joined.white && !state.endReason) && "invisible")}>
              <div className={cn(CARD, "relative mx-auto flex w-full max-w-md items-center gap-3 p-2 pl-4")}>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {aim ? (
                    <>
                      <span className="text-caption-2 font-semibold tabular-nums">힘 {Math.round(aim.power * 100)}%</span>
                      <Progress value={aim.power * 100} size="sm" aria-label="치는 힘" />
                    </>
                  ) : (
                    <span className="truncate text-caption-2 text-text-caption">
                      {/* 한 줄로 고정 — 좁은 폰에서 두 줄로 넘치지 않게, 키보드 안내는 마우스 환경에서만 */}
                      {canShoot ? (
                        <>
                          내 알을 뒤로 당겼다 놓아요
                          <span className="[@media(pointer:coarse)]:hidden"> (방향키 + Enter)</span>
                        </>
                      ) : (
                        "상대 차례를 기다려요"
                      )}
                    </span>
                  )}
                </div>
                <EmotePicker
                  onSend={sendEmote}
                  disabled={!(view.you && view.joined.white && !state.endReason) || emoteShowing}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => window.confirm("정말 기권할까요?") && act("resign")}
                  className="h-11 shrink-0"
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

      <Dialog open={isOver} onOpenChange={(open) => !open && leave()}>
        <Dialog.Content showCloseButton={false} closeOnOverlayClick={false} className="text-center">
          {view && state?.winner && (
            <div className="flex flex-col items-center gap-3">
              <Image
                src={`${ASSET}/stone-${state.winner}.webp`}
                alt={STONE_NAME[state.winner]}
                width={256}
                height={256}
                className="size-24"
              />
              <Dialog.Title className="text-title-1 font-black">{describeStatus(view, false)}</Dialog.Title>
              <Dialog.Description>{describeEnd(state)}</Dialog.Description>
            </div>
          )}

          <Button type="button" onClick={leave} className="h-12 w-full text-title-3 font-bold">
            처음으로
          </Button>

          <div className="mt-6">
            <AdSlot placement="capybara-alkkagi-result" />
          </div>
        </Dialog.Content>
      </Dialog>
    </div>
  );
}

export default CapybaraAlkkagi;
