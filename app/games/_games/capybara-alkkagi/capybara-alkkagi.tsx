"use client";

import { Crown } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Progress } from "@/components/feedback/progress";
import {
  EmoteBubble,
  EmotePicker,
  RoomLobby,
  TurnTimer,
  useEmoteShowing,
  useRoomRecord,
} from "@/components/games/capybara-room";
import { GameControls, LEAVE_CONFIRM_MESSAGE } from "@/components/games/game-controls";
import { GameOverActions } from "@/components/games/game-over-actions";
import { ShareButton } from "@/components/games/share-button";
import { Button } from "@/components/inputs/button";
import { Dialog } from "@/components/overlay/dialog";
import { cn } from "@/lib";
import { FULL_BLEED_LAYER, GAME_SOUNDS, GAME_TITLES } from "@/lib/games/constants";
import { opponent, type RoomView, type Stone, type Vector } from "@/lib/games/rooms";
import { useLockPageScroll } from "@/lib/games/use-lock-page-scroll";
import { useRoom } from "@/lib/games/use-room";
import { playGameSound, type SoundLayer } from "@/lib/lobby/settings";

import { ALKKAGI_SOUNDS, CLACK_GAP_MS, STRETCH_GAP_MS } from "./constants";
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

/** 알 버튼 위치. 백은 판을 180도 돌려 보고, 알 크기 기준 %라서 판 좌표 / 지름으로 옮기고 -50%로 가운데 맞춘다 */
function pieceTransform(piece: Piece, flipped: boolean) {
  const diameter = radiusOf(piece) * 2;
  const x = flipped ? FIELD - piece.x : piece.x;
  const y = flipped ? FIELD - piece.y : piece.y;
  return `translate(${(x / diameter) * 100 - 50}%, ${(y / diameter) * 100 - 50}%)`;
}

function aliveCount(pieces: Piece[], owner: Stone) {
  return pieces.filter((piece) => piece.owner === owner && !piece.out).length;
}

// 세기(0~1)에 맞춰 소리 크기와 음높이를 바꿔 재생한다
function playScaled(layers: readonly SoundLayer[], strength: number) {
  const level = 0.35 + 0.65 * strength;
  const pitch = 0.8 + 0.4 * strength;
  playGameSound(layers.map((layer) => ({ ...layer, level: layer.level * level, from: layer.from * pitch, to: layer.to * pitch })));
}

export function CapybaraAlkkagi() {
  const { view, error, pending, reconnecting, gone, spectateCode, copied, clockOffset, create, join, watch, act, sendEmote, copyInvite, leave } = useRoom<
    AlkkagiState,
    AlkkagiAction
  >("capybara-alkkagi");
  const emoteShowing = useEmoteShowing(view?.emote ?? null);
  const record = useRoomRecord("capybara-alkkagi", view);
  const [aim, setAim] = useState<Aim | null>(null);
  /** 샷 애니메이션 중이면 true. 알 위치는 state가 아니라 DOM에 바로 쓴다 */
  const [animating, setAnimating] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // 포인터 이벤트는 렌더링 사이에 여러 번 올 수 있어서 최신 조준값은 ref로도 들고 있는다
  const aimRef = useRef<Aim | null>(null);
  const dragPointer = useRef<number | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const seenShot = useRef<{ code: string; seq: number } | null>(null);
  const lastStretch = useRef({ at: 0, step: 0 });
  /** 방마다 대국 시작·끝 소리를 한 번씩만 내려고 직전에 본 상태를 들고 있는다 */
  const seenRound = useRef<{ code: string; started: boolean; over: boolean } | null>(null);
  /** 알 id → 버튼. 샷 애니메이션이 프레임마다 위치를 바로 쓴다 */
  const pieceButtons = useRef(new Map<number, HTMLButtonElement>());

  function updateAim(next: Aim | null) {
    aimRef.current = next;
    setAim(next);
  }

  const state = view?.state;
  const code = view?.code;
  const shotSeq = state?.lastShot?.seq ?? 0;
  const canShoot = Boolean(
    view && state && view.joined.white && !state.winner && view.you === state.turn && !animating && !pending && !reconnecting,
  );
  // 대국 중에는 알을 당기다 화면이 밀리지 않게 스크롤을 막는다
  useLockPageScroll(Boolean(view?.you && view.joined.white && state && !state.winner));
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

  /** 알 위치·떨어짐을 React 렌더 없이 버튼에 바로 쓴다 (JSX의 style·className과 같은 값) */
  const drawPieces = useEffectEvent((pieces: Piece[]) => {
    for (const piece of pieces) {
      const button = pieceButtons.current.get(piece.id);
      if (!button) continue;
      button.style.transform = pieceTransform(piece, flipped);
      button.firstElementChild?.classList.toggle("scale-50", piece.out);
      button.firstElementChild?.classList.toggle("opacity-0", piece.out);
    }
  });

  // 새 샷이 오면(내가 쳤든 상대가 쳤든) 서버와 같은 시뮬레이션을 돌려 프레임을 만들고 재생한다.
  // 방에 처음 들어왔을 때는 지난 샷을 다시 틀지 않는다.
  // 프레임마다 setState로 판 전체를 다시 그리면 초당 60번 렌더가 돌아서, 알 위치만 DOM에 바로 쓰고 React 렌더는 시작·끝 두 번만 한다
  const playNewShot = useEffectEvent(() => {
    const shot = view?.state.lastShot;
    const seen = seenShot.current;
    seenShot.current = code ? { code, seq: shotSeq } : null;
    if (!shot || !code || !seen || seen.code !== code || seen.seq >= shot.seq) return;

    const you = view?.you;
    const afterMessage = () => {
      const next = view?.state;
      // 결과(승패) 소리는 따로 나므로, 판이 이어질 때만 차례 소리를 낸다
      if (next && !next.winner) {
        if (shot.knocked > 0 && shot.by === you) playGameSound(GAME_SOUNDS.correct);
        else if (you && next.turn === you && shot.by !== you) playGameSound(ALKKAGI_SOUNDS.myTurn);
      }
      if (shot.knocked === 0) return;
      const combo = next?.combo ?? 0;
      showFlash(combo > 0 ? `퉁! ${shot.knocked}마리 · 한 번 더!` : `퉁! ${shot.knocked}마리`);
    };

    // 내 샷은 놓는 순간 이미 소리를 냈다 — 상대(친구·컴퓨터) 샷만 여기서 튕기는 소리
    const speed = Math.sqrt(shot.velocity.x * shot.velocity.x + shot.velocity.y * shot.velocity.y);
    if (shot.by !== you) playScaled(ALKKAGI_SOUNDS.flick, speed / MAX_SPEED);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (shot.knocked > 0) playGameSound(ALKKAGI_SOUNDS.fall);
      afterMessage();
      return;
    }

    const frames: Piece[][] = [];
    /** 부딪힌 프레임 → 충격 세기(0~1): 그 프레임에서 가장 많이 움직인 알의 속도로 어림한다 */
    const hitFrames = new Map<number, number>();
    const fallFrames = new Set<number>();
    simulateShot(shot.before, shot.pieceId, shot.velocity, (pieces, hit) => {
      const previous = frames.at(-1) ?? shot.before;
      if (hit) {
        let fastest = 0;
        pieces.forEach((piece, i) => {
          const dx = piece.x - previous[i].x;
          const dy = piece.y - previous[i].y;
          fastest = Math.max(fastest, Math.sqrt(dx * dx + dy * dy));
        });
        hitFrames.set(frames.length, Math.min(1, fastest / MAX_SPEED));
      }
      if (pieces.some((piece, i) => piece.out && !previous[i].out)) fallFrames.add(frames.length);
      frames.push(pieces.map((piece) => ({ ...piece })));
    });
    if (frames.length === 0) {
      afterMessage();
      return;
    }

    // 화면에 그리기 전에 첫 프레임을 올려 둔다 (서버가 준 샷 이후 위치가 한 번 번쩍 보이지 않게)
    drawPieces(frames[0]);
    setAnimating(true);
    const startedAt = performance.now();
    let shown = -1;
    let lastClack = 0;
    let rafId = requestAnimationFrame(function tick(now) {
      try {
        rafId = step(now) ? 0 : requestAnimationFrame(tick);
      } catch (caught) {
        // 한 프레임이라도 에러로 끊기면 animating이 true로 남아 알을 영영 못 친다 — 최종 위치로 맞추고 풀어 준다
        console.error(caught);
        stopShot();
      }
    });

    /** 한 화면 프레임을 그린다. 애니메이션이 끝났으면 true */
    function step(now: number) {
      // rAF의 now는 그 화면 프레임이 시작된 시각이라 바로 앞에서 잰 startedAt보다 이를 수 있다 — 음수 index(frames[-1] = undefined)가 되지 않게 0에서 막는다
      const index = Math.max(0, Math.min(frames.length - 1, Math.floor((now - startedAt) / STEP_MS)));
      let shaken = false;
      let fell = false;
      let impact = -1;
      for (let i = shown + 1; i <= index; i++) {
        const strength = hitFrames.get(i);
        if (strength !== undefined) {
          if (!shaken) shake();
          shaken = true;
          impact = Math.max(impact, strength);
        }
        if (fallFrames.has(i)) fell = true;
      }
      // 한 화면 프레임에 여러 번 부딪혀도 소리는 한 번, 그리고 CLACK_GAP_MS 간격을 둔다
      if (impact >= 0 && now - lastClack >= CLACK_GAP_MS) {
        lastClack = now;
        playScaled(ALKKAGI_SOUNDS.clack, impact);
      }
      if (fell) playGameSound(ALKKAGI_SOUNDS.fall);
      shown = index;
      if (index >= frames.length - 1) {
        // 마지막은 서버 상태(= JSX가 그린 값)로 맞춘다
        drawPieces(view?.state.pieces ?? []);
        setAnimating(false);
        afterMessage();
        return true;
      }
      drawPieces(frames[index]);
      return false;
    }

    return () => cancelAnimationFrame(rafId);
  });

  const stopShot = useEffectEvent(() => {
    drawPieces(view?.state.pieces ?? []);
    setAnimating(false);
  });

  useLayoutEffect(() => {
    let cancel: (() => void) | undefined;
    try {
      cancel = playNewShot();
    } catch (caught) {
      // 재생 준비(시뮬레이션·소리)에서 에러가 나도 화면을 오류로 넘기거나 알을 잠그지 않고 최종 위치로 둔다
      console.error(caught);
      stopShot();
    }
    return () => {
      cancel?.();
      stopShot();
    };
  }, [code, shotSeq]);

  const joinedWhite = Boolean(view?.joined.white);
  const isOver = Boolean(state?.endReason) && !animating;

  // 대국 시작(둘 다 들어옴)·끝(승패 결과)에 한 번씩 소리. 이미 끝난 방에 들어오면 결과 소리는 내지 않는다
  const playRoundSound = useEffectEvent(() => {
    if (!code || !view) {
      seenRound.current = null;
      return;
    }
    const seen = seenRound.current?.code === code ? seenRound.current : null;
    seenRound.current = { code, started: joinedWhite, over: isOver };
    if (!seen) {
      if (joinedWhite && !isOver && !view.state.lastShot) playGameSound(GAME_SOUNDS.start);
      return;
    }
    if (joinedWhite && !seen.started) playGameSound(GAME_SOUNDS.start);
    if (isOver && !seen.over) {
      const won = view.state.winner === view.you || !view.you;
      playGameSound(won ? GAME_SOUNDS.success : GAME_SOUNDS.fail);
    }
  });

  useEffect(() => {
    playRoundSound();
  }, [code, joinedWhite, isOver]);

  useEffect(() => {
    if (gone) playGameSound(GAME_SOUNDS.warning);
  }, [gone]);

  // 서버가 수를 거절하는 등 에러 문구가 새로 뜨면 삐빅
  useEffect(() => {
    if (error && code) playGameSound(GAME_SOUNDS.wrong);
  }, [error, code]);


  function fire(target: Aim) {
    updateAim(null);
    if (target.power < MIN_POWER) {
      // 너무 약하게 놓으면 취소 — 톡
      playGameSound(GAME_SOUNDS.tap);
      return;
    }
    playScaled(ALKKAGI_SOUNDS.flick, target.power);
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
    lastStretch.current = { at: 0, step: 0 };
    playGameSound(ALKKAGI_SOUNDS.grab);
    updateAim({ pieceId: piece.id, angle: forwardAngle, power: 0 });
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>, piece: Piece) {
    if (dragPointer.current !== event.pointerId) return;
    const point = toBoardPoint(event.clientX, event.clientY);
    if (!point) return;
    const pullX = piece.x - point.x;
    const pullY = piece.y - point.y;
    const distance = Math.sqrt(pullX * pullX + pullY * pullY);
    const power = Math.min(1, distance / MAX_PULL);
    // 힘이 10% 단위로 바뀔 때마다 끼릭 (너무 잦지 않게 STRETCH_GAP_MS 간격)
    const step = Math.round(power * 10);
    const now = performance.now();
    if (step !== lastStretch.current.step && now - lastStretch.current.at >= STRETCH_GAP_MS) {
      lastStretch.current = { at: now, step };
      playScaled(ALKKAGI_SOUNDS.stretch, power);
    }
    updateAim({ pieceId: piece.id, angle: Math.atan2(pullY, pullX), power });
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
    // Enter/Space는 fire에서 소리를 낸다
    if (event.key.startsWith("Arrow")) playGameSound(ALKKAGI_SOUNDS.aim);
    else if (event.key === "Escape") playGameSound(GAME_SOUNDS.tap);
    handler();
  }

  const pieces = state?.pieces ?? [];
  const toScreen = (point: Vector) => (flipped ? { x: FIELD - point.x, y: FIELD - point.y } : point);
  const aimedPiece = aim ? pieces.find((piece) => piece.id === aim.pieceId && !piece.out) : undefined;
  return (
    <div className="relative h-dvh w-full touch-manipulation select-none overflow-hidden bg-background text-text-strong [-webkit-tap-highlight-color:transparent]">
      <h1 className="sr-only">{GAME_TITLES["capybara-alkkagi"]}</h1>

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
        <RoomLobby
          title={GAME_TITLES["capybara-alkkagi"]}
          guide={`내 카피바라를 뒤로 당겼다 놓아서 상대 카피바라를 판 밖으로 떨어뜨려요. 왕관 쓴 대장은 크고 무거워서 잘 안 밀려요. 한 번에 ${TURN_TIME_MS / 1000}초`}
          room={{ slug: "capybara-alkkagi", pending, join, create, error, spectateCode, watch }}
          record={record}
        />
      ) : (
        // 좁은 화면은 카드가 가로를 꽉 채워 왼쪽 위 뒤로·효과음 버튼 두 개 아래에서 시작한다 (넓으면 카드가 가운데라 안 겹친다)
        <div className="absolute inset-0 flex flex-col items-center gap-3 pt-[calc(max(1rem,env(safe-area-inset-top))_+_3.5rem)] pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:pt-[calc(max(1rem,env(safe-area-inset-top))_+_7rem)]">
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      playGameSound(GAME_SOUNDS.tap);
                      copyInvite();
                    }}
                    className="h-10 w-full"
                  >
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
                      mine={state.turn === view.you}
                    />
                  )
                )}
              </div>
              {/* 에러는 줄을 늘리지 않고 카드 아래(판 위)에 띄운다. 판 윗부분을 덮으므로 누른 건 아래 판으로 지나가게 한다 */}
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
                  const mine = view.you === piece.owner;
                  const diameter = radiusOf(piece) * 2;
                  return (
                    <button
                      key={piece.id}
                      ref={(button) => {
                        if (button) pieceButtons.current.set(piece.id, button);
                        else pieceButtons.current.delete(piece.id);
                      }}
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
                        transform: pieceTransform(piece, flipped),
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
                  disabled={pending || reconnecting}
                  onClick={() => {
                    playGameSound(GAME_SOUNDS.tap);
                    if (window.confirm("정말 기권할까요?")) act("resign");
                  }}
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

      <Dialog open={isOver || gone} onOpenChange={(open) => !open && leave()}>
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
              <div className="flex items-center gap-3 rounded-full bg-bg-neutral py-1.5 pr-1.5 pl-5">
                <p className="text-caption-1 font-semibold">친구에게 공유할까요?</p>
                {/* 방 코드(?code=)가 붙은 주소 대신 게임 페이지를 공유한다 — 끝난 방으로 들어오지 않게 */}
                <ShareButton
                  title={GAME_TITLES["capybara-alkkagi"]}
                  text={`${GAME_TITLES["capybara-alkkagi"]} 한 판: ${describeStatus(view, false)} ${describeEnd(state)} 나랑 한 판 할래?`}
                  url={`${window.location.origin}${window.location.pathname}`}
                />
              </div>
            </div>
          )}
          {gone && !state?.winner && (
            <div className="flex flex-col items-center gap-3">
              <Dialog.Title className="text-title-1 font-black">방이 사라졌어요</Dialog.Title>
              <Dialog.Description>
                오래 비어 있어 방이 정리됐거나 서버에서 방을 찾을 수 없어요. 처음 화면에서 새로 시작해 주세요.
              </Dialog.Description>
            </div>
          )}

          {/* 다시 하기 = 방을 나와 친구·컴퓨터 고르는 첫 화면. 창이 뒤로 버튼을 덮으니 홈으로도 창 안에 둔다 */}
          <GameOverActions onRetry={leave} />
        </Dialog.Content>
      </Dialog>
    </div>
  );
}

export default CapybaraAlkkagi;
