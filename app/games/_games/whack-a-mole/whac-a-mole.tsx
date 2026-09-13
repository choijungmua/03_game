"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Clock3, Play, RotateCcw, Trophy } from "lucide-react";

import { AdSlot } from "@/components/ads/ad-slot";
import { Button } from "@/components/inputs/button";

import styles from "./whac-a-mole.module.css";

export const GAME_BALANCE = {
  durationSeconds: 30,
  initialMoleIntervalMs: 900,
  finalMoleIntervalMs: 520,
  timerTickMs: 100,
  pointsPerHit: 1,
} as const;

const BEST_SCORE_KEY = "tabply-whac-a-mole-best-score";
const HOLE_COUNT = 9;

type Phase = "idle" | "playing" | "result";

function getNextHole(current: number) {
  let next = Math.floor(Math.random() * HOLE_COUNT);
  while (next === current) next = Math.floor(Math.random() * HOLE_COUNT);
  return next;
}

function formatScore(score: number) {
  return new Intl.NumberFormat("ko-KR").format(score);
}

function getStoredBestScore() {
  if (typeof window === "undefined") return 0;
  const stored = window.localStorage.getItem(BEST_SCORE_KEY);
  const parsed = stored ? Number.parseInt(stored, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function subscribeToBestScore(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("whac-a-mole-best-score", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("whac-a-mole-best-score", onStoreChange);
  };
}

export function WhacAMole() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const bestScore = useSyncExternalStore(subscribeToBestScore, getStoredBestScore, () => 0);
  const [timeRemaining, setTimeRemaining] = useState<number>(GAME_BALANCE.durationSeconds);
  const [moleIndex, setMoleIndex] = useState(-1);
  const [feedback, setFeedback] = useState("시작 버튼을 누르면 두더지가 나타납니다.");
  const endAtRef = useRef(0);
  const nextMoleAtRef = useRef(0);
  const currentMoleRef = useRef(-1);

  const finishGame = useCallback(() => {
    setPhase("result");
    setMoleIndex(-1);
    currentMoleRef.current = -1;
    setTimeRemaining(0);
    setFeedback("게임이 끝났습니다. 다시 도전해 보세요.");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const remainingMs = Math.max(0, endAtRef.current - now);
      setTimeRemaining(Math.ceil(remainingMs / 1000));

      if (remainingMs === 0) {
        finishGame();
        return;
      }

      if (now >= nextMoleAtRef.current) {
        const next = getNextHole(currentMoleRef.current);
        currentMoleRef.current = next;
        setMoleIndex(next);
        const elapsed = GAME_BALANCE.durationSeconds * 1000 - remainingMs;
        const progress = Math.min(1, elapsed / (GAME_BALANCE.durationSeconds * 1000));
        nextMoleAtRef.current = now + Math.round(
          GAME_BALANCE.initialMoleIntervalMs -
            (GAME_BALANCE.initialMoleIntervalMs - GAME_BALANCE.finalMoleIntervalMs) * progress,
        );
      }
    }, GAME_BALANCE.timerTickMs);

    return () => window.clearInterval(intervalId);
  }, [finishGame, phase]);

  const startGame = useCallback(() => {
    const now = Date.now();
    const firstHole = Math.floor(Math.random() * HOLE_COUNT);
    endAtRef.current = now + GAME_BALANCE.durationSeconds * 1000;
    nextMoleAtRef.current = now + GAME_BALANCE.initialMoleIntervalMs;
    currentMoleRef.current = firstHole;
    setPhase("playing");
    setScore(0);
    setTimeRemaining(GAME_BALANCE.durationSeconds);
    setMoleIndex(firstHole);
    setFeedback("두더지를 찾으세요. 빈 홀은 감점되지 않습니다.");
  }, []);

  const handleHoleClick = useCallback(
    (index: number) => {
      if (phase !== "playing") return;
      if (index !== moleIndex) {
        setFeedback("빗나갔어요. 감점은 없습니다.");
        return;
      }

      setScore((currentScore) => {
        const nextScore = currentScore + GAME_BALANCE.pointsPerHit;
        if (nextScore > bestScore) {
          window.localStorage.setItem(BEST_SCORE_KEY, String(nextScore));
          window.dispatchEvent(new Event("whac-a-mole-best-score"));
        }
        return nextScore;
      });
      setFeedback("정확해요! 다음 두더지를 찾으세요.");
      const next = getNextHole(index);
      currentMoleRef.current = next;
      setMoleIndex(next);
      nextMoleAtRef.current = Date.now() + GAME_BALANCE.initialMoleIntervalMs;
    },
    [bestScore, moleIndex, phase],
  );

  const isResult = phase === "result";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>TABPLY ARCADE</p>
            <h1 className={styles.title}>두더지 잡기</h1>
          </div>
          <div className={styles.best} aria-label={`최고 점수 ${formatScore(bestScore)}점`}>
            <Trophy aria-hidden="true" size={16} />
            <span>최고 {formatScore(bestScore)}</span>
          </div>
        </header>

        <section className={styles.gameCard} aria-label="두더지 잡기 게임">
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>점수</span>
              <strong className={styles.statValue}>{formatScore(score)}</strong>
            </div>
            <div className={styles.statDivider} aria-hidden="true" />
            <div className={styles.stat}>
              <span className={styles.statLabel}><Clock3 aria-hidden="true" size={14} /> 남은 시간</span>
              <strong className={styles.statValue}>{timeRemaining}<small>초</small></strong>
            </div>
          </div>

          <div className={styles.boardWrap}>
            <div className={styles.board} aria-label="두더지 구멍 9개">
              {Array.from({ length: HOLE_COUNT }, (_, index) => {
                const isActive = phase === "playing" && index === moleIndex;
                return (
                  <button
                    key={index}
                    type="button"
                    aria-label={isActive ? `${index + 1}번 홀, 두더지 있음` : `${index + 1}번 홀`}
                    className={`${styles.hole} ${isActive ? styles.activeHole : ""}`}
                    onClick={() => handleHoleClick(index)}
                  >
                    <span className={styles.dirt} aria-hidden="true" />
                    {isActive && <span className={styles.mole} aria-hidden="true"><span className={styles.moleEyes} /></span>}
                  </button>
                );
              })}
            </div>
          </div>

          <p className={styles.feedback} aria-live="polite">{feedback}</p>

          {phase === "idle" && (
            <Button type="button" size="xl" className={styles.primaryAction} onClick={startGame} leftIcon={<Play aria-hidden="true" size={17} />}>
              게임 시작
            </Button>
          )}
          {isResult && (
            <div className={styles.resultActions}>
              <div className={styles.resultScore}><span>이번 점수</span><strong>{formatScore(score)}<small>점</small></strong></div>
              <Button type="button" size="xl" className={styles.primaryAction} onClick={startGame} leftIcon={<RotateCcw aria-hidden="true" size={17} />}>
                다시 도전
              </Button>
            </div>
          )}
          {phase === "playing" && <p className={styles.hint}>두더지를 터치하면 점수를 얻어요</p>}
        </section>

        {isResult && <AdSlot placement="whac-a-mole-result" />}
      </div>
    </main>
  );
}

export default WhacAMole;
