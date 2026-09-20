"use client";

import { ChevronDown } from "lucide-react";
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
  ANIMAL_FACES,
  ANIMAL_IMAGE_BASE,
  ANIMALS,
  BIG_COUNT_SECONDS,
  BOARD_SIZE,
  BURST_AT_MS,
  COMBO_WINDOW_MS,
  DRAG_THRESHOLD,
  FAIL_TIER_INDEX,
  FALL_MS,
  FEVER_COMBO,
  FEVER_MS,
  HINT_DELAY_MS,
  HURRY_SECONDS,
  LAST_PANG_INTRO_MS,
  LAST_PANG_OUTRO_MS,
  PANG_SOUNDS,
  POP_MS,
  POP_SPARKS,
  RESULT_SOUND_DELAY_MS,
  RESULT_TAP_GUARD_MS,
  ROUND_SECONDS,
  SHAKE_CLEAR_COUNT,
  SWAP_MS,
  TIME_OVER_MS,
} from "./constants";
import { PangLeaderboard } from "./leaderboard";
import { PangHud } from "./pang-hud";
import {
  EMPTY_SCORE_BREAKDOWN,
  type Blast,
  type ScoreBreakdown,
  type TimeBonusReason,
  addScoreBreakdown,
  blastsIn,
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
  nextSpecial,
  planClear,
  rowOf,
  scoreFor,
  scoreBreakdownFor,
  shuffleBoard,
  swapTiles,
  timeBonusFor,
  timeBonusReasonsFor,
  type Tile,
} from "./logic";
import { getRank, insertRecord, saveRecords, usePangRecords } from "./records";
import { getPangTier, PANG_TIERS } from "./tiers";

export const COUNTDOWN_VALUES = [3, 2, 1] as const;
export const COUNTDOWN_STEP_MS = 800;

const TITLE = GAME_TITLES["capybara-pang"];

/** lastpang: 시간이 끝난 뒤 "타임 오버!" → 남은 폭탄·무지개를 터뜨리는 라스트 팡 (입력은 안 받는다) */
type Phase = "idle" | "countdown" | "playing" | "lastpang" | "result";

interface RoundResult {
  score: number;
  breakdown: ScoreBreakdown;
  maxCombo: number;
  recordId: string | null;
  /** 한 번도 터뜨리지 못해 기록이 없으면 null */
  rank: number | null;
  /** 라스트 팡으로 더해진 점수 (score에 이미 들어 있다) */
  lastBonus: number;
}

type TimeGain = {
  readonly id: number;
  readonly seconds: number;
  readonly reasons: readonly TimeBonusReason[];
};

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

/** 남은 시간 글자 + 줄어드는 막대. 마지막 HURRY_SECONDS초엔 빨갛게 두근거린다 */
function PlayTimer({ startAt, hurry }: { startAt: number; hurry: boolean }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const remaining = (elapsedMs: number) => Math.max(0, ROUND_SECONDS - elapsedMs / 1000).toFixed(1);
  useFrameText(valueRef, () => {
    const seconds = Number(remaining(Date.now() - startAt));
    if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(seconds / ROUND_SECONDS, 1)})`;
    return seconds.toFixed(1);
  });

  return (
    <div className="flex w-full items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/20">
        <div
          ref={barRef}
          className={cn(
            "h-full origin-left rounded-full transition-colors duration-300",
            hurry ? "bg-red-500" : "bg-success",
          )}
        />
      </div>
      <p
        data-testid="play-timer"
        data-hurry={hurry || undefined}
        className={cn(
          "w-16 text-right text-title-3 font-bold tabular-nums transition-colors",
          hurry && "text-red-400 motion-safe:animate-pulse",
        )}
      >
        <span ref={valueRef}>{remaining(0)}</span>초
      </p>
    </div>
  );
}

/** 마지막 BIG_COUNT_SECONDS초: 판 위에 5·4·3·2·1이 초마다 크게 튀어나왔다 옅어진다 (판은 그대로 누를 수 있다) */
function FinalCountdown({ startAt }: { startAt: number }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const timers = Array.from({ length: BIG_COUNT_SECONDS }, (_, i) => {
      const value = BIG_COUNT_SECONDS - i;
      return setTimeout(() => setLeft(value), startAt + (ROUND_SECONDS - value) * 1000 - Date.now());
    });
    timers.push(setTimeout(() => setLeft(null), startAt + ROUND_SECONDS * 1000 - Date.now()));
    return () => timers.forEach(clearTimeout);
  }, [startAt]);
  if (left === null) return null;
  return (
    <span
      key={left}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-[min(40vmin,12rem)] font-black leading-none text-white [text-shadow:0_4px_24px_rgb(0_0_0/0.45)] animate-pang-count motion-reduce:animate-none motion-reduce:opacity-50"
    >
      {left}
    </span>
  );
}

/** 폭탄은 자기 줄·칸을 따라 가로·세로 광선이 쓸고, 무지개는 고리가 퍼진다 (펑 하는 순간에 맞춰) */
function BlastEffects({ blasts }: { blasts: readonly Blast[] }) {
  const cell = 100 / BOARD_SIZE;
  return blasts.map(({ index, special }) =>
    special === "bomb" ? (
      <span key={`bomb-${index}`} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 motion-reduce:hidden">
        <span
          className="absolute left-0 w-full rounded-full bg-linear-to-r from-transparent via-yellow-100 to-transparent shadow-[0_0_18px_rgb(253_224_71/0.9)] animate-pang-beam-x"
          style={{ top: `${rowOf(index) * cell + cell * 0.3}%`, height: `${cell * 0.4}%`, animationDelay: `${BURST_AT_MS}ms` }}
        />
        <span
          className="absolute top-0 h-full rounded-full bg-linear-to-b from-transparent via-yellow-100 to-transparent shadow-[0_0_18px_rgb(253_224_71/0.9)] animate-pang-beam-y"
          style={{ left: `${colOf(index) * cell + cell * 0.3}%`, width: `${cell * 0.4}%`, animationDelay: `${BURST_AT_MS}ms` }}
        />
      </span>
    ) : (
      <span
        key={`rainbow-${index}`}
        aria-hidden="true"
        className="pointer-events-none absolute z-10 rounded-full border-4 border-white/90 shadow-[0_0_20px_rgb(255_255_255/0.8)] animate-pang-ring motion-reduce:hidden"
        style={{
          left: `${colOf(index) * cell}%`,
          top: `${rowOf(index) * cell}%`,
          width: `${cell}%`,
          height: `${cell}%`,
          animationDelay: `${BURST_AT_MS}ms`,
        }}
      />
    ),
  );
}

/** 터질 때 튀어나가는 조각 하나의 방향·기울기·시작 시각. 조각 크기가 블록의 25%라 이동 거리(블록 %)에 4를 곱한다 */
function sparkStyle(spark: (typeof POP_SPARKS)[number]): React.CSSProperties & { "--dx": string; "--dy": string } {
  return {
    "--dx": `${spark.dx * 4}%`,
    "--dy": `${spark.dy * 4}%`,
    // 눈물은 뾰족한 꼬리가 날아온 쪽(블록 가운데)을 향하게
    rotate: spark.kind === "tear" ? `${spark.dx < 0 ? 45 : -135}deg` : undefined,
    animationDelay: `${BURST_AT_MS}ms`,
  };
}

/**
 * 판의 블록 하나. 색 원 위에 동물 펠트 얼굴. 가만히 있을 땐 숨 쉬듯 오르내리며 가끔 눈웃음으로 깜빡이고,
 * 고르면 콩콩 뛰고, 힌트면 도리도리, 터질 땐 우는 얼굴로 흔들다 펑 — 눈물·반짝이가 튀어나간다 (constants.ts ANIMALS 참고)
 */
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
  const face = (suffix: string) => `${ANIMAL_IMAGE_BASE}/${animal.key}${suffix}.webp`;
  // 블록마다 숨 쉬기·깜빡임 박자를 어긋나게 (id로 정해서 다시 그려도 박자가 안 튄다)
  const beat = ((tile.id * 7919) % 1000) / 1000;
  const resting = !popping && !selected && !hinted;
  const style: React.CSSProperties & { "--drop": number } = {
    width: `${100 / BOARD_SIZE}%`,
    height: `${100 / BOARD_SIZE}%`,
    translate: `${colOf(index) * 100}% ${rowOf(index) * 100}%`,
    "--drop": dropRows ?? 0,
  };
  return (
    <div
      data-cell={index}
      data-testid="pang-tile"
      data-kind={tile.kind}
      data-special={tile.special}
      className={cn(
        // 자리 옮기기(바꾸기·아래로 채우기)만 transition, 새로 떨어지는 블록은 pang-drop(바닥에서 말랑하게 눌림)
        "absolute top-0 left-0 flex items-center justify-center transition-[translate] duration-200 ease-out motion-reduce:transition-none",
        dropRows !== undefined && "origin-bottom animate-pang-drop motion-reduce:animate-none",
      )}
      style={style}
    >
      <div
        className={cn(
          "relative flex size-[88%] items-center justify-center rounded-full shadow-[inset_0_-4px_0_rgb(0_0_0/0.18)]",
          // 무지개는 색이 도는 층(아래 span)을 따로 깐다 — 이 칸엔 이미 숨 쉬기·터지기 애니메이션이 있어서
          tile.special === "rainbow" ? "text-neutral-950" : animal.colorClass,
          tile.special === "bomb" && "ring-4 ring-white ring-inset",
          selected && "outline-4 outline-white",
          focused && !selected && "outline-2 outline-offset-1 outline-primary",
          // 터질 땐 우는 얼굴로 흔들며 버티다 풍선처럼 펑 / 고르면 콩콩 / 힌트면 도리도리 / 평소엔 숨 쉬듯 오르내림
          popping
            ? "animate-pang-pop motion-reduce:animate-none"
            : selected
              ? "animate-pang-hop motion-reduce:animate-none motion-reduce:scale-110"
            : hinted
              ? "ring-4 ring-white ring-offset-2 ring-offset-background motion-safe:animate-pang-wiggle"
                : "animate-pang-idle motion-reduce:animate-none",
        )}
        style={resting ? { animationDelay: `${-beat * 2.4}s` } : undefined}
      >
          {tile.special === "bomb" ? (
            <Image
              src="/assets/images/games/capybara-pang/powerups/acorn-bomb.png"
              alt="도토리 폭탄"
              width={128}
              height={128}
              unoptimized
              draggable={false}
              className="size-[72%] select-none object-contain motion-safe:animate-pang-fuse"
            />
          ) : tile.special === "rainbow" ? (
            <Image
              src="/assets/images/games/capybara-pang/powerups/rainbow-lily.png"
              alt="무지개 수련"
              width={128}
              height={128}
              unoptimized
              draggable={false}
              className="size-[72%] select-none object-contain"
            />
        ) : (
          <>
            <Image
              src={face(popping ? ANIMAL_FACES.cry : ANIMAL_FACES.calm)}
              alt={animal.name}
              width={128}
              height={128}
              unoptimized
              draggable={false}
              className="size-[86%] select-none"
            />
            {/* 눈웃음 얼굴을 위에 겹쳐 두고, 평소엔 가끔 깜빡이듯 잠깐 보이고 고르면 계속 보인다 */}
            {!popping && (
              <Image
                src={face(ANIMAL_FACES.happy)}
                alt=""
                aria-hidden="true"
                width={128}
                height={128}
                unoptimized
                draggable={false}
                className={cn(
                  "absolute size-[86%] select-none",
                  selected ? "opacity-100" : "opacity-0 motion-safe:animate-pang-blink",
                )}
                style={selected ? undefined : { animationDuration: `${3.2 + beat * 3}s`, animationDelay: `${-beat * 6}s` }}
              />
            )}
          </>
        )}
      </div>
      {/* 펑 하는 순간 눈물 둘은 좌우로, 반짝이 넷은 사방으로 튀어나간다 (조각 크기 25% → 이동 거리 ×4) */}
      {popping &&
        POP_SPARKS.map((spark, sparkIndex) => (
          <span
            key={sparkIndex}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute flex size-[25%] items-center justify-center animate-pang-spark motion-reduce:hidden",
              spark.kind === "tear"
                ? "rounded-[50%_50%_50%_0] bg-sky-300 shadow-[inset_-2px_-2px_0_rgb(0_0_0/0.12)]"
                : "text-[min(6.5vmin,2.2rem)] leading-none text-yellow-200 drop-shadow",
            )}
            style={sparkStyle(spark)}
          >
            {spark.kind === "star" && "✦"}
          </span>
        ))}
    </div>
  );
}

export function CapybaraPang() {
  const records = usePangRecords();
  // 표정 그림(특히 터질 때만 쓰는 우는 얼굴)을 그때 받으면 한순간 빈칸이 보이니 들어오자마자 전부 받아 둔다
  useEffect(() => {
    for (const animal of ANIMALS) {
      for (const suffix of Object.values(ANIMAL_FACES)) new window.Image().src = `${ANIMAL_IMAGE_BASE}/${animal.key}${suffix}.webp`;
    }
  }, []);
  const [phase, setPhase] = useState<Phase>("idle");
  const locked = phase === "countdown" || phase === "playing" || phase === "lastpang";
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
  const [scoreGain, setScoreGain] = useState<{ readonly id: number; readonly points: number } | null>(null);
  const [timeGain, setTimeGain] = useState<TimeGain | null>(null);
  const [combo, setCombo] = useState({ count: 0, at: 0 });
  const [feverUntil, setFeverUntil] = useState(0);
  /** 지금 터지는 폭탄·무지개 (가로·세로 광선, 퍼지는 고리) */
  const [blasts, setBlasts] = useState<readonly Blast[]>([]);
  /** 마지막 HURRY_SECONDS초: 시간 막대가 빨개지고 판 둘레가 두근거린다 */
  const [hurry, setHurry] = useState(false);
  /** 판 위에 크게 박히는 글씨 */
  const [banner, setBanner] = useState<"timeover" | "lastpang" | null>(null);
  const [lastBonus, setLastBonus] = useState(0);

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
  const lastBonusRef = useRef(0);
  const timeBonusRef = useRef(0);
  const scoreBreakdownRef = useRef<ScoreBreakdown>(EMPTY_SCORE_BREAKDOWN);
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
    setBlasts([]);
    setBanner(null);
    setHurry(false);
    setSelected(null);
    setPhase("result");

    const finalScore = scoreRef.current;
    if (finalScore === 0) {
      playGameSound([...PANG_SOUNDS.timeUp, ...delayLayers(GAME_SOUNDS.fail, RESULT_SOUND_DELAY_MS)]);
      setResult({ score: 0, breakdown: EMPTY_SCORE_BREAKDOWN, maxCombo: 0, recordId: null, rank: null, lastBonus: 0 });
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
    setResult({
      score: finalScore,
      breakdown: scoreBreakdownRef.current,
      maxCombo: record.maxCombo,
      recordId: record.id,
      rank,
      lastBonus: lastBonusRef.current,
    });
  });

  /**
   * 시간 끝: "타임 오버!" → (진행 중이던 연쇄는 끝까지 보여 주고) 남은 폭탄·무지개가 있으면 "라스트 팡!"
   * 하나씩 터뜨려 점수를 더한다 → 결과. 도중에 그만두면(roundRef가 바뀌면) 멈춘다
   */
  const timeUp = useEffectEvent(async () => {
    const round = roundRef.current;
    dragRef.current = null;
    setSelected(null);
    setCursor(null);
    setHint(null);
    setPhase("lastpang");
    setBanner("timeover");
    playGameSound(PANG_SOUNDS.timeUp);
    await wait(TIME_OVER_MS);
    while (busyRef.current) {
      await wait(50);
      if (round !== roundRef.current) return;
    }
    if (round !== roundRef.current) return;
    busyRef.current = true;

    if (nextSpecial(boardRef.current) >= 0) {
      setBanner("lastpang");
      playGameSound(GAME_SOUNDS.record);
      await wait(LAST_PANG_INTRO_MS);
      // 터지는 동안엔 판이 보여야 하니 글씨는 걷고, 보너스는 점수 옆 배지가 올라가며 보여 준다
      setBanner(null);
      for (let guard = 0; guard < BOARD_SIZE * BOARD_SIZE; guard += 1) {
        if (round !== roundRef.current) return;
        const current = boardRef.current;
        const index = nextSpecial(current);
        if (index < 0) break;
        // 연쇄로 같이 터지는 특수 블록까지 planClear가 범위를 넓힌다. 보너스는 콤보·피버 없이 블록 수대로
        const plan = planClear(current, [], [index], [], idsRef.current);
        const points = scoreFor(plan.cleared.size, 1, false);
        scoreBreakdownRef.current = addScoreBreakdown(
          scoreBreakdownRef.current,
          scoreBreakdownFor(plan.cleared.size, 1, false),
        );
        lastBonusRef.current += points;
        scoreRef.current += points;
        setLastBonus(lastBonusRef.current);
        setScore(scoreRef.current);
        setScoreGain({ id: scoreRef.current, points });
        playGameSound(PANG_SOUNDS.lastPang);
        setBlasts(blastsIn(current, plan.cleared));
        setPopping(plan.cleared);
        shakeBoard();
        await wait(POP_MS);
        if (round !== roundRef.current) return;
        const next = collapse(
          current.map((tile, cell) => (plan.cleared.has(cell) ? null : tile)),
          Math.random,
          idsRef.current,
        );
        setPopping(EMPTY_CELLS);
        setBlasts([]);
        setSpawned(next.spawned);
        commit(next.board);
        await wait(FALL_MS);
      }
    }
    setBanner(null);
    await wait(LAST_PANG_OUTRO_MS);
    if (round !== roundRef.current) return;
    finishRound();
  });

  useEffect(() => {
    if (phase !== "playing") return;
    const untilEnd = playStartAt + ROUND_SECONDS * 1000 - Date.now();
    const untilHurry = untilEnd - HURRY_SECONDS * 1000;
    const timers = [setTimeout(() => void timeUp(), Math.max(0, untilEnd))];
    if (untilHurry > 0) timers.push(setTimeout(() => setHurry(true), untilHurry));
    // 마지막 10초는 초마다 째깍, 3·2·1초 전은 카운트다운 삐
    for (let left = HURRY_SECONDS; left >= 1; left -= 1) {
      const sound = left <= COUNTDOWN_VALUES.length ? GAME_SOUNDS.countdown : PANG_SOUNDS.tick;
      const delay = untilEnd - left * 1000;
      if (delay > 0) timers.push(setTimeout(() => playGameSound(sound), delay));
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, playStartAt]);

  useEffect(() => {
    if (!timeGain) return;
    const timer = setTimeout(() => setTimeGain(null), 900);
    return () => clearTimeout(timer);
  }, [timeGain]);

  /** 폭탄·무지개처럼 한꺼번에 많이 터지면 펑 하는 순간 판이 쿵 흔들린다 (jsdom엔 animate가 없어 선택 호출) */
  function shakeBoard() {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    boardElRef.current?.animate?.(
      [{ translate: "0 0" }, { translate: "-7px 4px" }, { translate: "6px -4px" }, { translate: "-3px 2px" }, { translate: "0 0" }],
      { duration: 320, delay: BURST_AT_MS, easing: "ease-out" },
    );
  }

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

  function registerClear(tileCount: number, specialCount: number) {
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
    const remainingSeconds = Math.max(0, (playStartAt + ROUND_SECONDS * 1000 - now) / 1000);
    const points = scoreFor(tileCount, nextCombo, feverUntilRef.current > now, specialCount, remainingSeconds);
    scoreBreakdownRef.current = addScoreBreakdown(
      scoreBreakdownRef.current,
      scoreBreakdownFor(tileCount, nextCombo, feverUntilRef.current > now, specialCount, remainingSeconds),
    );
    scoreRef.current += points;
    setScore(scoreRef.current);
    setScoreGain({ id: scoreRef.current, points });
    setCombo({ count: nextCombo, at: now });

    const timeBonus = timeBonusFor(nextCombo, specialCount, timeBonusRef.current);
    if (timeBonus > 0) {
      timeBonusRef.current += timeBonus;
      setPlayStartAt((current) => current + timeBonus * 1000);
      setTimeGain({ id: scoreRef.current, seconds: timeBonus, reasons: timeBonusReasonsFor(nextCombo, specialCount) });
    }
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

      const activeBlasts = blastsIn(current, plan.cleared);
      registerClear(plan.cleared.size + plan.created.size, activeBlasts.length);
      playGameSound(plan.cleared.size > SHAKE_CLEAR_COUNT ? GAME_SOUNDS.explosion : PANG_SOUNDS.pop);
      setPopping(plan.cleared);
      setBlasts(activeBlasts);
      if (plan.cleared.size > SHAKE_CLEAR_COUNT) shakeBoard();
      await wait(POP_MS);
      if (round !== roundRef.current) return;

      const holes = current.map((tile, index) => plan.created.get(index) ?? (plan.cleared.has(index) ? null : tile));
      const next = collapse(holes, Math.random, idsRef.current);
      setPopping(EMPTY_CELLS);
      setBlasts([]);
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
    lastBonusRef.current = 0;
    timeBonusRef.current = 0;
    scoreBreakdownRef.current = EMPTY_SCORE_BREAKDOWN;
    setScore(0);
    setScoreGain(null);
    setTimeGain(null);
    setCombo({ count: 0, at: 0 });
    setFeverUntil(0);
    setLastBonus(0);
    setHurry(false);
    setBanner(null);
    setBlasts([]);
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
    setBanner(null);
    setHurry(false);
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
  const resultScore = result?.score.toLocaleString("ko-KR") ?? "";
  const fever = feverUntil > 0;

  const screenClass =
    phase === "countdown"
      ? "bg-success text-neutral-950"
      : phase === "playing" || phase === "lastpang"
      ? "bg-background text-foreground"
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
        : phase === "lastpang"
          ? banner === "lastpang"
          ? "피날레! 남은 폭탄과 무지개가 터지며 점수가 더해져요"
            : "타임 오버!"
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
      {locked && <div aria-hidden="true" className={cn(FULL_BLEED_LAYER, "-z-20", screenClass)} />}
      {phase !== "result" && (
        <div
          aria-hidden="true"
          className={cn(FULL_BLEED_LAYER, "-z-10 bg-cover bg-center opacity-35", phase === "playing" && "opacity-25")}
          style={{ backgroundImage: "url(/assets/images/games/capybara-plane-shooter/background/swamp-morning.webp)" }}
        />
      )}
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

      {(phase === "playing" || phase === "lastpang") && (
        <div className="flex w-full max-w-xl flex-col items-center gap-4 pt-8">
          <PangHud
            timer={<PlayTimer startAt={playStartAt} hurry={hurry} />}
            score={score}
            scoreGain={scoreGain}
            timeGain={timeGain}
            combo={combo.count}
            fever={fever}
            lastBonus={lastBonus}
          />

          <p
            aria-live="polite"
            className={cn(
              "min-h-7 rounded-full px-3 py-1 text-caption-1 font-semibold",
              hintCells.length > 0 ? "bg-black/60 text-white" : "text-transparent",
            )}
          >
            {hintCells.length > 0 ? "힌트: 흰 테두리의 두 친구를 서로 바꿔 보세요" : "힌트 자리"}
          </p>

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
            className={cn(
              "relative aspect-square w-[min(100%,calc(100dvh-15.5rem))] touch-none overflow-hidden rounded-2xl bg-card/90 ring-1 ring-border backdrop-blur-sm transition-shadow duration-300",
              // 피버 동안은 판 둘레가 노랗게 빛나고, 마지막 10초엔 붉게 두근거린다
              fever
              ? "shadow-[0_0_0_4px_rgb(253_224_71/0.85),0_0_32px_rgb(253_224_71/0.55)]"
                : hurry && phase === "playing" && "shadow-[0_0_0_4px_rgb(248_113_113/0.8)] motion-safe:animate-pang-hurry",
            )}
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
            <BlastEffects blasts={blasts} />
            {phase === "playing" && <FinalCountdown startAt={playStartAt} />}
            {banner && (
              <span
                key={banner}
                data-testid="pang-banner"
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/25 motion-reduce:bg-black/40"
              >
                <span
                  className={cn(
                    "rounded-3xl px-6 py-3 text-[min(12vmin,3.5rem)] font-black leading-none text-white [text-shadow:0_4px_0_rgb(0_0_0/0.35)] animate-pang-banner motion-reduce:animate-none",
                    banner === "lastpang" ? "bg-orange-500" : "bg-red-500",
                  )}
                >
                  {banner === "lastpang" ? "피날레!" : "타임 오버!"}
                </span>
              </span>
            )}
          </div>
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
              <p className="flex max-w-full flex-nowrap items-baseline gap-2 whitespace-nowrap font-black tabular-nums">
                <span
                  data-testid="result-score"
                  className={cn(
                    "leading-none",
                    resultScore.length <= 5
                      ? "text-[clamp(2.5rem,14vw,7rem)]"
                      : resultScore.length <= 8
                        ? "text-[clamp(2.25rem,10vw,5rem)]"
                        : "text-[clamp(1.75rem,8vw,3.5rem)]",
                  )}
                >
                  {resultScore}
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
            <dl
              data-testid="result-score-breakdown"
              aria-label="점수 구성"
              className="grid w-full gap-px overflow-hidden rounded-xl bg-black/15 text-caption-1 font-semibold tabular-nums"
            >
              {[
                { key: "base", label: "기본 점수", points: result.breakdown.base },
                { key: "combo", label: "콤보 보너스", points: result.breakdown.combo },
                { key: "special", label: "특수 블록 보너스", points: result.breakdown.special },
                { key: "time", label: "시간 보너스", points: result.breakdown.time },
              ].map((row) => (
                <div key={row.key} className="flex items-center justify-between bg-black/10 px-4 py-2">
                  <dt>{row.label}</dt>
                  <dd data-testid={`result-score-${row.key}`}>+{row.points.toLocaleString("ko-KR")}</dd>
                </div>
              ))}
            </dl>
            {result.lastBonus > 0 && (
              <p data-testid="result-last-pang" className="-mt-3 text-caption-1 font-bold opacity-80">
                피날레 보너스 +{result.lastBonus.toLocaleString("ko-KR")}점 포함
              </p>
            )}

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
