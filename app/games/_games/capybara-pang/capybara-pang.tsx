"use client";

import { Bomb, ChevronDown, Sparkles } from "lucide-react";
import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { GameControls } from "@/components/games/game-controls";
import { GameOverActions } from "@/components/games/game-over-actions";
import { ShareButton } from "@/components/games/share-button";
import { cn } from "@/lib";
import { FULL_BLEED_LAYER, GAME_SOUNDS, GAME_TITLES } from "@/lib/games/constants";
import { submitGameRecord } from "@/lib/games/game-events";
import { useFrameText } from "@/lib/games/use-frame-text";
import { useInView } from "@/lib/games/use-in-view";
import { useLockPageScroll } from "@/lib/games/use-lock-page-scroll";
import { playGameSound, type SoundLayer } from "@/lib/lobby/settings";

import {
  ANIMAL_IMAGE_BASE,
  ANIMALS,
  BOARD_SIZE,
  COMBO_WINDOW_MS,
  DRAG_THRESHOLD,
  FAIL_TIER_INDEX,
  FALL_MS,
  FEVER_COMBO,
  FEVER_MS,
  HINT_DELAY_MS,
  PANG_SOUNDS,
  POP_MS,
  RESULT_SOUND_DELAY_MS,
  RESULT_TAP_GUARD_MS,
  ROUND_SECONDS,
  SWAP_MS,
} from "./constants";
import { PangLeaderboard } from "./leaderboard";
import {
  type Board,
  collapse,
  colOf,
  createBoard,
  findMove,
  findRuns,
  type IdSource,
  isAdjacent,
  isValidSwap,
  mostCommonKind,
  neighbor,
  planClear,
  rowOf,
  scoreFor,
  shuffleBoard,
  swapTiles,
  type Tile,
} from "./logic";
import { getRank, insertRecord, saveRecords, usePangRecords } from "./records";
import { getPangTier, PANG_TIERS } from "./tiers";

export const COUNTDOWN_VALUES = [3, 2, 1] as const;
export const COUNTDOWN_STEP_MS = 800;

const TITLE = GAME_TITLES["capybara-pang"];

type Phase = "idle" | "countdown" | "playing" | "result";

interface RoundResult {
  score: number;
  maxCombo: number;
  recordId: string | null;
  /** 한 번도 터뜨리지 못해 기록이 없으면 null */
  rank: number | null;
}

const EMPTY_CELLS: ReadonlySet<number> = new Set();

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** 앞 소리가 끝난 뒤 이어서 나도록 모든 층을 ms만큼 미룬다 */
function delayLayers(layers: readonly SoundLayer[], ms: number): SoundLayer[] {
  return layers.map((layer) => ({ ...layer, at: (layer.at ?? 0) + ms }));
}

/** 남은 시간 글자 + 줄어드는 막대 */
function PlayTimer({ startAt }: { startAt: number }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const remaining = (elapsedMs: number) => Math.max(0, ROUND_SECONDS - elapsedMs / 1000).toFixed(1);
  useFrameText(valueRef, () => remaining(Date.now() - startAt));

  return (
    <div className="flex w-full items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/20">
        <div
          className="h-full origin-left animate-pang-time rounded-full bg-success"
          style={{ animationDuration: `${ROUND_SECONDS}s` }}
        />
      </div>
      <p data-testid="play-timer" className="w-16 text-right text-title-3 font-bold tabular-nums">
        <span ref={valueRef}>{remaining(0)}</span>초
      </p>
    </div>
  );
}

/** 판의 블록 하나. 색 원 위에 동물 펠트 얼굴을 얹고, 터질 때만 우는 얼굴로 바꾼다 (constants.ts ANIMALS 참고) */
function PangTile({
  tile,
  index,
  popping,
  dropRows,
  selected,
  hinted,
  focused,
}: {
  tile: Tile;
  index: number;
  popping: boolean;
  dropRows: number | undefined;
  selected: boolean;
  hinted: boolean;
  focused: boolean;
}) {
  const animal = ANIMALS[tile.kind];
  const style: React.CSSProperties & { "--drop": number } = {
    width: `${100 / BOARD_SIZE}%`,
    height: `${100 / BOARD_SIZE}%`,
    translate: `${colOf(index) * 100}% ${rowOf(index) * 100}%`,
    transitionDuration: `${popping ? POP_MS : FALL_MS}ms`,
    "--drop": dropRows ?? 0,
  };
  return (
    <div
      data-cell={index}
      data-testid="pang-tile"
      data-kind={tile.kind}
      data-special={tile.special}
      className={cn(
        "absolute top-0 left-0 flex items-center justify-center transition-[translate,scale,opacity,rotate] ease-out motion-reduce:transition-none",
        dropRows !== undefined && "animate-pang-drop motion-reduce:animate-none",
        // 터질 땐 우는 얼굴로 바뀌면서 펑 부풀어 올랐다 사라진다 (쪼그라들면 눈물이 안 보인다)
        popping && "scale-125 rotate-12 opacity-0 motion-reduce:scale-0 motion-reduce:rotate-0",
      )}
      style={style}
    >
      <div
        className={cn(
          "flex size-[88%] items-center justify-center rounded-full text-[clamp(0.75rem,4vmin,1.5rem)] font-black shadow-[inset_0_-4px_0_rgb(0_0_0/0.18)] transition-transform duration-100",
          tile.special === "rainbow"
            ? "bg-linear-to-br from-pink-400 via-yellow-300 to-sky-400 text-neutral-950"
            : animal.colorClass,
          tile.special === "bomb" && "ring-4 ring-white ring-inset",
          selected && "scale-110 outline-4 outline-white",
          focused && !selected && "outline-2 outline-offset-1 outline-primary",
          hinted && "animate-pulse",
        )}
      >
        {tile.special === "bomb" ? (
          <Bomb aria-hidden="true" className="size-1/2" />
        ) : tile.special === "rainbow" ? (
          <Sparkles aria-hidden="true" className="size-1/2" />
        ) : (
          <Image
            // 터지는 순간만 우는 얼굴 — 눈물이 튀면서 블록이 쪼그라든다
            src={`${ANIMAL_IMAGE_BASE}/${animal.key}${popping ? "-cry" : ""}.webp`}
            alt={animal.name}
            width={128}
            height={128}
            unoptimized
            draggable={false}
            className="size-[86%] select-none"
          />
        )}
      </div>
    </div>
  );
}

export function CapybaraPang() {
  const records = usePangRecords();
  const [phase, setPhase] = useState<Phase>("idle");
  const locked = phase === "countdown" || phase === "playing";
  useLockPageScroll(locked);
  const [countdownIndex, setCountdownIndex] = useState(0);
  const [playStartAt, setPlayStartAt] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);

  const [board, setBoard] = useState<Board>([]);
  /** 지금 터지는 중인 칸 */
  const [popping, setPopping] = useState<ReadonlySet<number>>(EMPTY_CELLS);
  /** 방금 위에서 새로 떨어진 블록 id → 몇 칸 위에서 떨어지는지 */
  const [spawned, setSpawned] = useState<ReadonlyMap<number, number>>(new Map());
  const [selected, setSelected] = useState<number | null>(null);
  /** 키보드로 옮기는 칸. 방향키를 누르기 전엔 표시하지 않는다 */
  const [cursor, setCursor] = useState<number | null>(null);
  /** 힌트는 계산한 판이 그대로일 때만 보여준다 */
  const [hint, setHint] = useState<{ board: Board; cells: readonly number[] } | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState({ count: 0, at: 0 });
  const [feverUntil, setFeverUntil] = useState(0);

  const idsRef = useRef<IdSource>({ next: 0 });
  const boardRef = useRef<Board>([]);
  /** 바꾸기·터지기 애니메이션 중이면 입력을 받지 않는다 */
  const busyRef = useRef(false);
  /** 판이 끝나거나 취소되면 올려서, 진행 중이던 연쇄가 멈추게 한다 */
  const roundRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const lastClearAtRef = useRef(0);
  const feverUntilRef = useRef(0);
  const dragRef = useRef<{ index: number; x: number; y: number; moved: boolean } | null>(null);
  const boardElRef = useRef<HTMLDivElement>(null);
  const resultAtRef = useRef(0);
  const { ref: recordsRef, inView: recordsVisible } = useInView<HTMLElement>(phase === "result");

  useEffect(() => {
    if (phase !== "countdown") return;
    const timers = COUNTDOWN_VALUES.map((_, index) =>
      setTimeout(() => {
        if (index < COUNTDOWN_VALUES.length - 1) {
          playGameSound(GAME_SOUNDS.countdown);
          setCountdownIndex(index + 1);
          return;
        }
        playGameSound(GAME_SOUNDS.go);
        setPlayStartAt(Date.now());
        setPhase("playing");
      }, COUNTDOWN_STEP_MS * (index + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const finishRound = useEffectEvent(() => {
    roundRef.current += 1;
    busyRef.current = false;
    dragRef.current = null;
    resultAtRef.current = Date.now();
    setPopping(EMPTY_CELLS);
    setSelected(null);
    setPhase("result");

    const finalScore = scoreRef.current;
    if (finalScore === 0) {
      playGameSound([...PANG_SOUNDS.timeUp, ...delayLayers(GAME_SOUNDS.fail, RESULT_SOUND_DELAY_MS)]);
      setResult({ score: 0, maxCombo: 0, recordId: null, rank: null });
      return;
    }

    const now = Date.now();
    const record = { id: String(now), score: finalScore, maxCombo: maxComboRef.current, at: now };
    const rank = getRank(records, record);
    const failed = PANG_TIERS.indexOf(getPangTier(finalScore)) >= FAIL_TIER_INDEX;
    playGameSound([
      ...PANG_SOUNDS.timeUp,
      ...delayLayers(failed ? GAME_SOUNDS.fail : GAME_SOUNDS.success, RESULT_SOUND_DELAY_MS),
      ...(rank === 1 && !failed ? delayLayers(GAME_SOUNDS.record, RESULT_SOUND_DELAY_MS + 700) : []),
    ]);
    saveRecords(insertRecord(records, record));
    void submitGameRecord("capybara-pang", record.score, record);
    setResult({ score: finalScore, maxCombo: record.maxCombo, recordId: record.id, rank });
  });

  useEffect(() => {
    if (phase !== "playing") return;
    const timers = [setTimeout(finishRound, ROUND_SECONDS * 1000)];
    // 끝나기 3·2·1초 전마다 삐
    for (const left of COUNTDOWN_VALUES) {
      timers.push(setTimeout(() => playGameSound(GAME_SOUNDS.countdown), (ROUND_SECONDS - left) * 1000));
    }
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // 콤보 시간이 지나면 콤보 표시를 지운다
  useEffect(() => {
    if (combo.count === 0) return;
    const timer = setTimeout(() => setCombo({ count: 0, at: Date.now() }), COMBO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [combo]);

  useEffect(() => {
    if (feverUntil === 0) return;
    const timer = setTimeout(() => setFeverUntil(0), feverUntil - Date.now());
    return () => clearTimeout(timer);
  }, [feverUntil]);

  // 한동안 손을 안 대면 둘 수 있는 자리를 반짝인다
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setTimeout(() => {
      const move = findMove(boardRef.current);
      if (move) setHint({ board: boardRef.current, cells: move });
    }, HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, board, selected]);

  function commit(next: Board) {
    boardRef.current = next;
    setBoard(next);
  }

  function registerClear(tileCount: number) {
    const now = Date.now();
    const nextCombo = now - lastClearAtRef.current <= COMBO_WINDOW_MS ? comboRef.current + 1 : 1;
    comboRef.current = nextCombo;
    lastClearAtRef.current = now;
    maxComboRef.current = Math.max(maxComboRef.current, nextCombo);
    if (nextCombo % FEVER_COMBO === 0) {
      feverUntilRef.current = now + FEVER_MS;
      setFeverUntil(feverUntilRef.current);
      playGameSound(GAME_SOUNDS.record);
    }
    scoreRef.current += scoreFor(tileCount, nextCombo, feverUntilRef.current > now);
    setScore(scoreRef.current);
    setCombo({ count: nextCombo, at: now });
  }

  /** 줄이 없어질 때까지 터뜨리기 → 떨어뜨리기를 반복한다 */
  async function resolveBoard(start: Board, seeds: readonly number[], preferred: readonly number[], rainbowTarget?: number) {
    const round = roundRef.current;
    busyRef.current = true;
    let current = start;
    for (let first = true; ; first = false) {
      const runs = findRuns(current);
      if (runs.length === 0 && (!first || seeds.length === 0)) break;
      const plan = first
        ? planClear(current, runs, seeds, preferred, idsRef.current, rainbowTarget)
        : planClear(current, runs, [], [], idsRef.current);

      registerClear(plan.cleared.size + plan.created.size);
      playGameSound(plan.cleared.size > 5 ? GAME_SOUNDS.explosion : PANG_SOUNDS.pop);
      setPopping(plan.cleared);
      await wait(POP_MS);
      if (round !== roundRef.current) return;

      const holes = current.map((tile, index) => plan.created.get(index) ?? (plan.cleared.has(index) ? null : tile));
      const next = collapse(holes, Math.random, idsRef.current);
      setPopping(EMPTY_CELLS);
      setSpawned(next.spawned);
      commit(next.board);
      await wait(FALL_MS);
      if (round !== roundRef.current) return;
      current = next.board;
    }
    if (!findMove(current)) commit(shuffleBoard(current, Math.random));
    busyRef.current = false;
  }

  async function trySwap(a: number, b: number) {
    if (busyRef.current || phase !== "playing") return;
    const round = roundRef.current;
    const before = boardRef.current;
    busyRef.current = true;
    setSelected(null);
    const swapped = swapTiles(before, a, b);
    commit(swapped);
    await wait(SWAP_MS);
    if (round !== roundRef.current) return;

    if (!isValidSwap(before, a, b)) {
      playGameSound(GAME_SOUNDS.wrong);
      commit(before);
      await wait(SWAP_MS);
      if (round === roundRef.current) busyRef.current = false;
      return;
    }

    const rainbowFrom = [a, b].find((index) => before[index].special === "rainbow");
    if (rainbowFrom === undefined) {
      await resolveBoard(swapped, [], [a, b]);
      return;
    }
    // 무지개는 바꾼 동물을 전부 터뜨린다 (바꾼 뒤 무지개는 상대 칸에 있다)
    const other = rainbowFrom === a ? b : a;
    const target = before[other].special === "rainbow" ? mostCommonKind(before) : before[other].kind;
    await resolveBoard(swapped, [other], [], target);
  }

  /** 탭: 고르기 → 옆 칸 탭하면 바꾸기. 특수 블록은 그냥 누르면 터진다 */
  function tapCell(index: number) {
    if (busyRef.current || phase !== "playing") return;
    if (selected !== null && selected !== index && isAdjacent(selected, index)) {
      void trySwap(selected, index);
      return;
    }
    if (boardRef.current[index].special !== "none") {
      setSelected(null);
      void resolveBoard(boardRef.current, [index], []);
      return;
    }
    playGameSound(GAME_SOUNDS.tap);
    setSelected(selected === index ? null : index);
  }

  function cellFromEvent(event: React.PointerEvent) {
    const cell = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-cell]") : null;
    return cell ? Number(cell.dataset.cell) : null;
  }

  function handleBoardPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const index = cellFromEvent(event);
    if (index === null) return;
    dragRef.current = { index, x: event.clientX, y: event.clientY, moved: false };
  }

  function handleBoardPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.moved) return;
    const tileSize = (boardElRef.current?.getBoundingClientRect().width ?? 0) / BOARD_SIZE;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < Math.max(tileSize * DRAG_THRESHOLD, 8)) return;
    drag.moved = true;
    const other =
      Math.abs(dx) > Math.abs(dy) ? neighbor(drag.index, 0, Math.sign(dx)) : neighbor(drag.index, Math.sign(dy), 0);
    if (other !== null) void trySwap(drag.index, other);
  }

  function handleBoardPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && !drag.moved) tapCell(drag.index);
  }

  function startCountdown() {
    roundRef.current += 1;
    busyRef.current = false;
    idsRef.current = { next: 0 };
    commit(createBoard(Math.random, idsRef.current));
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    lastClearAtRef.current = 0;
    feverUntilRef.current = 0;
    setScore(0);
    setCombo({ count: 0, at: 0 });
    setFeverUntil(0);
    setSelected(null);
    setCursor(null);
    setSpawned(new Map());
    setPopping(EMPTY_CELLS);
    playGameSound(GAME_SOUNDS.countdown);
    setCountdownIndex(0);
    setPhase("countdown");
  }

  function cancelRound() {
    roundRef.current += 1;
    busyRef.current = false;
    playGameSound(GAME_SOUNDS.pause);
    setPhase("idle");
  }

  function canStart() {
    if (phase === "idle") return true;
    return phase === "result" && Date.now() - resultAtRef.current >= RESULT_TAP_GUARD_MS;
  }

  function handleClick() {
    if (canStart()) startCountdown();
  }

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.target instanceof HTMLElement && event.target.closest("a, button, input, textarea, select")) return;

    if (phase === "playing") {
      const arrow = ARROWS[event.key];
      if (arrow) {
        event.preventDefault();
        const center = Math.floor((BOARD_SIZE * BOARD_SIZE) / 2);
        setCursor(cursor === null ? center : (neighbor(cursor, arrow[0], arrow[1]) ?? cursor));
        return;
      }
      if ((event.key === " " || event.key === "Enter") && !event.repeat) {
        event.preventDefault();
        if (cursor !== null) tapCell(cursor);
      }
      return;
    }

    if ((event.key === " " || event.key === "Enter") && !event.repeat && canStart()) {
      event.preventDefault();
      startCountdown();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const tier = result ? getPangTier(result.score) : null;
  const fever = feverUntil > 0;

  const screenClass =
    phase === "countdown"
      ? "bg-success text-neutral-950"
      : phase === "playing"
        ? fever
          ? "bg-violet-950 text-white"
          : "bg-background text-foreground"
        : phase === "result" && tier && !recordsVisible
          ? cn(tier.bgClass, tier.fgClass)
          : "bg-background text-foreground";

  const rankLabel = result && result.rank !== null ? `${result.rank}위` : "터뜨린 블록이 없어요";

  const shareText =
    phase === "result" && result && tier
      ? `${TITLE} ${result.score.toLocaleString("ko-KR")}점(최대 ${result.maxCombo}콤보)으로 ${tier.label} 등급이 나왔어요. 나보다 높을 수 있나요?`
      : "같은 동물 3개를 이어 터뜨리는 60초 퍼즐, 같이 해 봐요";

  const liveMessage =
    phase === "countdown"
      ? `${COUNTDOWN_VALUES[countdownIndex]}`
      : phase === "playing"
        ? `${ROUND_SECONDS}초 동안 같은 동물 3개를 이어 터뜨리세요. 방향키로 칸을 옮기고 Enter로 고르세요`
        : phase === "result" && result && tier
          ? `${rankLabel}, ${result.score}점, 최대 ${result.maxCombo}콤보, ${tier.label} 등급`
          : "";

  const hintCells = hint && hint.board === board ? hint.cells : [];

  return (
    <div
      data-testid="capybara-pang-screen"
      data-phase={phase}
      onClick={handleClick}
      className={cn(
        "relative isolate flex min-h-dvh w-full select-none flex-col items-center justify-center overflow-hidden px-4 py-10 transition-colors [-webkit-tap-highlight-color:transparent]",
        locked ? "touch-none" : "cursor-pointer touch-manipulation",
        phase === "result" ? "duration-700" : "duration-200",
        screenClass,
      )}
    >
      {locked && <div aria-hidden="true" className={cn(FULL_BLEED_LAYER, "-z-10", screenClass)} />}
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {phase === "idle" && (
        <ShareButton
          className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]"
          title={TITLE}
          text={shareText}
        />
      )}

      <GameControls onCancelRound={locked ? cancelRound : undefined} />

      {phase === "idle" && (
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <header className="space-y-2">
            <h1 className="px-12 text-title-1 font-bold text-text-strong">{TITLE}</h1>
            <p className="text-caption-1 text-balance text-text-caption">
              {ROUND_SECONDS}초 동안 옆 블록과 바꿔 같은 동물 3개를 이어 터뜨리세요. 4개는 폭탄, 5개는 무지개가 되고,
              콤보를 {FEVER_COMBO}번 이으면 점수 두 배 피버가 시작돼요.
            </p>
          </header>

          <p className="text-title-1 font-bold text-text-strong">클릭해서 시작하세요</p>

          <PangLeaderboard records={records} />
        </div>
      )}

      {phase !== "idle" && <h1 className="sr-only">{TITLE}</h1>}

      {phase === "countdown" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            key={countdownIndex}
            data-testid="countdown"
            className="animate-in fade-in zoom-in-50 animation-duration-300 text-[11rem] font-black leading-none tabular-nums sm:text-[15rem]"
          >
            {COUNTDOWN_VALUES[countdownIndex]}
          </span>
          <p className="text-title-3 font-semibold opacity-80">같은 동물 3개를 이어 터뜨리세요</p>
        </div>
      )}

      {phase === "playing" && (
        <div className="flex w-full max-w-xl flex-col items-center gap-4 pt-8">
          <div className="flex w-full items-end justify-between gap-4">
            <p className="flex flex-col">
              <span className="text-caption-2 font-semibold opacity-70">점수</span>
              <span data-testid="play-score" className="text-title-1 font-black tabular-nums">
                {score.toLocaleString("ko-KR")}
              </span>
            </p>
            <div className="flex flex-col items-end gap-1">
              {fever && (
                <span
                  data-testid="fever"
                  className="rounded-full bg-yellow-300 px-3 py-0.5 text-caption-1 font-black text-neutral-950 motion-safe:animate-pulse"
                >
                  피버 ×2
                </span>
              )}
              <span
                data-testid="play-combo"
                className={cn("text-title-3 font-bold tabular-nums", combo.count < 2 && "invisible")}
              >
                {combo.count}콤보
              </span>
            </div>
          </div>

          <div
            ref={boardElRef}
            role="application"
            aria-label={`${TITLE} 게임판. 방향키로 칸을 옮기고 Enter로 고른 뒤 옆 칸에서 Enter로 바꿔요. 폭탄·무지개는 Enter로 바로 터져요`}
            data-testid="pang-board"
            onPointerDown={handleBoardPointerDown}
            onPointerMove={handleBoardPointerMove}
            onPointerUp={handleBoardPointerUp}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
            className="relative aspect-square w-[min(100%,calc(100dvh-14rem))] touch-none overflow-hidden rounded-2xl bg-black/15"
          >
            {board.map((tile, index) => (
              <PangTile
                key={tile.id}
                tile={tile}
                index={index}
                popping={popping.has(index)}
                dropRows={spawned.get(tile.id)}
                selected={selected === index}
                hinted={hintCells.includes(index)}
                focused={cursor === index}
              />
            ))}
          </div>

          <PlayTimer startAt={playStartAt} />
        </div>
      )}

      {phase === "result" && result && tier && (
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <section
            data-testid="result-hero"
            className="flex min-h-[calc(100dvh-5rem)] w-full flex-col items-center justify-center gap-6"
          >
            <div className="flex flex-col items-center gap-3">
              <p data-testid="result-tier" className="rounded-full bg-black/15 px-4 py-1 text-caption-1 font-bold">
                {tier.label}
              </p>
              <p className="flex items-baseline gap-2 font-black tabular-nums">
                <span data-testid="result-score" className="text-[5rem] leading-none sm:text-[7rem]">
                  {result.score.toLocaleString("ko-KR")}
                </span>
                <span className="text-title-1">점</span>
              </p>
              <p data-testid="result-rank" className="text-title-2 font-bold tabular-nums">
                {rankLabel}
              </p>
            </div>

            <p data-testid="result-summary" className="text-title-3 font-semibold text-balance">
              {tier.label} <span data-testid="result-combo">최대 {result.maxCombo}콤보</span>, {tier.description}
            </p>

            <div
              className="flex cursor-default items-center gap-3 rounded-full bg-black/10 py-1.5 pr-1.5 pl-5"
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
            >
              <p className="text-caption-1 font-semibold">이 기록을 친구에게 공유할까요?</p>
              <ShareButton title={TITLE} text={shareText} />
            </div>

            <div className="flex w-full flex-col items-center gap-2">
              <GameOverActions onRetry={startCountdown} className="max-w-xs" />
              <p className="flex items-center gap-1 text-caption-2 font-medium opacity-80">
                <ChevronDown aria-hidden="true" className="size-4" />
                아래로 내리면 순위 기록이 나와요
              </p>
            </div>
          </section>

          <section
            ref={recordsRef}
            data-testid="result-records"
            data-visible={recordsVisible}
            onPointerDown={stopPropagation}
            onClick={stopPropagation}
            className={cn(
              "flex w-full cursor-default flex-col gap-6 pb-6 transition-[opacity,translate] duration-700",
              recordsVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0",
            )}
          >
            <PangLeaderboard records={records} highlightId={result.recordId ?? undefined} />
          </section>
        </div>
      )}
    </div>
  );
}

export default CapybaraPang;
