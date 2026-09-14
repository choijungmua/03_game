"use client";

import Image from "next/image";
import { memo, useEffect, useEffectEvent, useRef, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { Progress } from "@/components/feedback/progress";
import { GameControls } from "@/components/games/game-controls";
import { Button } from "@/components/inputs/button";
import { Dialog } from "@/components/overlay/dialog";
import { cn } from "@/lib";
import { GAME_TITLES } from "@/lib/games/constants";
import { useLockPageScroll } from "@/lib/games/use-lock-page-scroll";

import {
  addBite,
  AWAY_MS_RANGE,
  DECAY_GRACE_MS,
  DECAY_INTERVAL_MS,
  decayGauge,
  EAT_DELAY_MS,
  EAT_INTERVAL_MS,
  type FoodStage,
  getFoodStage,
  pickDuration,
  pickLook,
  pickWarningMs,
} from "./logic";

type GameStatus = "ready" | "playing" | "success" | "fail";
type OwnerState = "away" | "turning" | "looking";
type CapybaraPose = "idle" | "eating" | "caught";
type GaugeTrend = "up" | "down";

interface SpriteBox {
  left: string;
  top: string;
  width: string;
}

const ASSET = "/assets/images/games/capybara-sneak";
const SPRITE_SIZES = "(orientation: portrait) 40vw, 30vw";

// 1920×1080 배경 기준 위치(%). 자세마다 캔버스 안 발 위치가 달라서 발끝이 같은 곳에 오도록 보정했다
const OWNER_BOX: SpriteBox = { left: "34.11%", top: "23.15%", width: "31.11%" };
// 접시 가운데가 무대 가로 중앙(x 960)에 오게 둔다
const FOOD_BOX: SpriteBox = { left: "43.14%", top: "64.24%", width: "13.72%" };
// 16:10·4:3 화면에서 무대 양옆이 잘려도 보이도록 오른쪽 끝(x 1860)이 아니라 수박 가까이(x 1560)에 둔다
const CAPYBARA_BOXES: Record<CapybaraPose, SpriteBox> = {
  idle: { left: "59.79%", top: "53.92%", width: "22.21%" },
  eating: { left: "59.88%", top: "51.87%", width: "22.21%" },
  caught: { left: "59.66%", top: "52.81%", width: "22.21%" },
};

const OWNER_IMAGES: Record<"away" | "looking", { src: string; alt: string }> = {
  away: { src: `${ASSET}/owner/owner-away.png`, alt: "등을 돌리고 설거지하는 주인" },
  looking: { src: `${ASSET}/owner/owner-looking.png`, alt: "이쪽을 돌아보는 주인" },
};
const FOOD_IMAGES: Record<FoodStage, string> = {
  full: "수박이 가득 담긴 접시",
  half: "반쯤 먹은 수박 접시",
  empty: "다 먹고 씨만 남은 접시",
};
const CAPYBARA_IMAGES: Record<CapybaraPose, string> = {
  idle: "눈치를 보는 카피바라",
  eating: "수박을 먹는 카피바라",
  caught: "들켜서 놀란 카피바라",
};

const OWNER_STATUS_MESSAGE: Record<OwnerState, string> = {
  away: "",
  turning: "주인이 돌아보려고 해요",
  looking: "주인이 보고 있어요",
};

function preventDefault(event: React.SyntheticEvent) {
  event.preventDefault();
}

interface StageProps {
  ownerState: OwnerState;
  foodStage: FoodStage;
  pose: CapybaraPose;
  munching: boolean;
}

/**
 * 주방 무대(배경·주인·수박·카피바라 그림). 게이지는 누르는 동안 80ms마다 바뀌지만 무대는 그때 바뀌지 않으므로
 * memo로 묶어 그림 10장을 매번 다시 그리지 않는다
 */
const SneakStage = memo(function SneakStage({ ownerState, foodStage, pose, munching }: StageProps) {
  const ownerImage = ownerState === "looking" ? "looking" : "away";

  return (
    <>
      {/* 세로 화면에서 무대 위아래 빈 곳을 같은 배경을 흐리게 깔아 채운다 */}
      <Image
        src={`${ASSET}/background/back.webp`}
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        draggable={false}
        className="pointer-events-none scale-110 object-cover opacity-70 blur-2xl"
      />

      {/* 가로 화면에서는 16:9 무대가 화면을 꽉 덮도록(넘치는 쪽은 가운데 기준으로 잘림) 정중앙에 고정한다 */}
      <div className="@container absolute top-1/2 left-1/2 aspect-video w-full -translate-x-1/2 -translate-y-1/2 landscape:w-[max(100%,calc(100dvh*16/9))]">
        <Image
          src={`${ASSET}/background/back.webp`}
          alt="창밖으로 나무가 보이는 주방"
          fill
          priority
          sizes="100vw"
          draggable={false}
          className="pointer-events-none object-cover"
        />

        <div data-testid="owner" data-state={ownerState} className="absolute inset-0">
          {(["away", "looking"] as const).map((key) => (
            <Image
              key={key}
              src={OWNER_IMAGES[key].src}
              alt={ownerImage === key ? OWNER_IMAGES[key].alt : ""}
              aria-hidden={ownerImage === key ? undefined : true}
              width={1086}
              height={1448}
              loading="eager"
              sizes={SPRITE_SIZES}
              draggable={false}
              className={cn(
                "pointer-events-none absolute h-auto",
                ownerImage === key ? "opacity-100" : "opacity-0",
              )}
              style={OWNER_BOX}
            />
          ))}
          {ownerState === "turning" && (
            <span
              data-testid="owner-warning"
              aria-hidden="true"
              className="absolute top-[13%] left-[49.7%] flex size-[5cqw] -translate-x-1/2 animate-bounce items-center justify-center rounded-full bg-warning text-[3.4cqw] font-black text-neutral-950 shadow-lg"
            >
              !
            </span>
          )}
        </div>

        <Image
          src={`${ASSET}/background/front.webp`}
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          draggable={false}
          className="pointer-events-none object-cover"
        />

        <div data-testid="food" data-stage={foodStage} className="absolute inset-0">
          <span className="absolute top-[84%] left-[43.75%] h-[2.5%] w-[12.5%] rounded-full bg-black/15 blur-sm" />
          {(["full", "half", "empty"] as const).map((stage) => (
            <Image
              key={stage}
              src={`${ASSET}/food/watermelon-${stage}.png`}
              alt={foodStage === stage ? FOOD_IMAGES[stage] : ""}
              aria-hidden={foodStage === stage ? undefined : true}
              width={1254}
              height={1254}
              loading="eager"
              sizes={SPRITE_SIZES}
              draggable={false}
              className={cn(
                "pointer-events-none absolute h-auto",
                foodStage === stage ? "opacity-100" : "opacity-0",
                munching && "animate-plate-shake",
              )}
              style={FOOD_BOX}
            />
          ))}
        </div>

        <div data-testid="capybara" data-pose={pose} className="absolute inset-0">
          <span className="absolute top-[86.5%] left-[61.35%] h-[3.5%] w-[18%] rounded-full bg-black/15 blur-sm" />
          {(["idle", "eating", "caught"] as const).map((key) => (
            <Image
              key={key}
              src={`${ASSET}/capybara/capybara-${key}.png`}
              alt={pose === key ? CAPYBARA_IMAGES[key] : ""}
              aria-hidden={pose === key ? undefined : true}
              width={1254}
              height={1254}
              loading="eager"
              sizes={SPRITE_SIZES}
              draggable={false}
              className={cn(
                "pointer-events-none absolute h-auto origin-bottom",
                pose === key ? "opacity-100" : "opacity-0",
                munching && key === "eating" && "animate-munch",
              )}
              style={CAPYBARA_BOXES[key]}
            />
          ))}
          {munching &&
            (["와구", "와구", "냠"] as const).map((word, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="absolute top-[52%] animate-munch-pop text-[2.6cqw] font-black text-white opacity-0 [paint-order:stroke] [-webkit-text-stroke:0.4cqw_rgb(0_0_0/0.55)]"
                style={{ left: `${56 + i * 4}%`, animationDelay: `${i * 200}ms` }}
              >
                {word}
              </span>
            ))}
        </div>
      </div>
    </>
  );
});

export function CapybaraSneak() {
  const [status, setStatus] = useState<GameStatus>("ready");
  const [ownerState, setOwnerState] = useState<OwnerState>("away");
  const [gauge, setGauge] = useState(0);
  const [trend, setTrend] = useState<GaugeTrend>("up");
  const [pressing, setPressing] = useState(false);
  const [paused, setPaused] = useState(false);
  useLockPageScroll(status === "playing");

  // 먹기·감소·주인 타이머는 화면이 다시 그려지기 전에도 여러 번 돌 수 있어서,
  // 판정은 렌더링 결과 대신 항상 최신 값을 담은 ref로 한다
  const statusRef = useRef<GameStatus>("ready");
  const ownerRef = useRef<OwnerState>("away");
  const gaugeRef = useRef(0);
  // 지금 보이는 주인 상태(away/turning/looking)가 다음 상태로 바뀌는 시각(ms epoch).
  // 멈출 때 여기서 "남은 시간"을 계산해두면, 이어할 때 같은 상태를 남은 시간만큼만 이어갈 수 있다
  const phaseEndsAtRef = useRef(0);
  // away 주기에서 "!" 경고가 뜨는 시점(경고 길이)을 기억해둔다 — away 중에 멈췄다 이어할 때도 같은 경고 길이를 쓰기 위해
  const warningMsRef = useRef(0);
  // 멈출 때 계산한 "남은 시간". null이 아니면 다음 effect 실행이 새 주기 대신 이 시간부터 이어간다
  const remainingRef = useRef<number | null>(null);
  // 다음 게이지 감소 틱이 언제인지(ms epoch). 안 누르고 있을 때만 의미가 있다
  const decayAtRef = useRef(0);
  // 멈출 때(안 누르고 있었다면) 계산한 감소까지 남은 시간. null이면 다음 감소 effect가 처음부터(DECAY_GRACE_MS) 기다린다
  const decayRemainingRef = useRef<number | null>(null);

  function changeStatus(next: GameStatus) {
    statusRef.current = next;
    setStatus(next);
  }

  const moveOwner = useEffectEvent((next: OwnerState) => {
    if (statusRef.current !== "playing") return;
    ownerRef.current = next;
    setOwnerState(next);
  });

  const bite = useEffectEvent(() => {
    if (statusRef.current !== "playing") return;

    if (ownerRef.current === "looking") {
      changeStatus("fail");
      return;
    }

    const nextGauge = addBite(gaugeRef.current);
    gaugeRef.current = nextGauge;
    setGauge(nextGauge);
    setTrend("up");
    if (nextGauge >= 100) changeStatus("success");
  });

  const decay = useEffectEvent(() => {
    if (statusRef.current !== "playing" || gaugeRef.current === 0) return;

    const nextGauge = decayGauge(gaugeRef.current);
    gaugeRef.current = nextGauge;
    setGauge(nextGauge);
    setTrend("down");
  });

  // 게임 중에만 주인이 등 돌림 → "!" 경고 → 돌아봄(가끔은 흘끗) → 다시 등 돌림을 반복한다
  useEffect(() => {
    if (status !== "playing" || paused) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    // delayMs 뒤에 등을 돌린다(다음 away 주기 시작). looking이 끝날 때와 이어하기(looking 이어감)가 같이 쓴다
    function scheduleAwayAfter(delayMs: number) {
      phaseEndsAtRef.current = Date.now() + delayMs;
      timers.push(
        setTimeout(() => {
          moveOwner("away");
          scheduleAway();
        }, delayMs),
      );
    }

    // delayMs 뒤에 돌아봄(가끔은 흘끗). away 경로와 이어하기(turning 이어감)가 같이 쓴다
    function scheduleLooking(delayMs: number) {
      timers.push(
        setTimeout(() => {
          moveOwner("looking");
          const look = pickLook();
          scheduleAwayAfter(look.ms);
        }, delayMs),
      );
    }

    function scheduleAway() {
      const awayMs = pickDuration(AWAY_MS_RANGE);
      const warningMs = Math.min(awayMs, pickWarningMs(gaugeRef.current));
      warningMsRef.current = warningMs;
      phaseEndsAtRef.current = Date.now() + awayMs;
      timers.push(setTimeout(() => moveOwner("turning"), awayMs - warningMs));
      scheduleLooking(awayMs);
    }

    const remaining = remainingRef.current;
    if (remaining === null) {
      scheduleAway();
    } else {
      // 멈추기 전 상태·남은 시간 그대로 이어간다 — 멈춰서 시선을 피하거나 경고를 늘릴 수 없다
      remainingRef.current = null;
      if (ownerRef.current === "looking") {
        scheduleAwayAfter(remaining);
      } else if (ownerRef.current === "turning") {
        phaseEndsAtRef.current = Date.now() + remaining;
        scheduleLooking(remaining);
      } else {
        phaseEndsAtRef.current = Date.now() + remaining;
        timers.push(setTimeout(() => moveOwner("turning"), Math.max(0, remaining - warningMsRef.current)));
        scheduleLooking(remaining);
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [status, paused]);

  // 누르고 딜레이가 지나면 첫 입, 그 뒤로는 손을 뗄 때까지 일정 간격으로 한 입씩 먹는다
  useEffect(() => {
    if (!pressing || status !== "playing" || paused) return;

    let interval: ReturnType<typeof setInterval> | undefined;
    const delay = setTimeout(() => {
      bite();
      interval = setInterval(bite, EAT_INTERVAL_MS);
    }, EAT_DELAY_MS);

    return () => {
      clearTimeout(delay);
      if (interval !== undefined) clearInterval(interval);
    };
  }, [pressing, status, paused]);

  // 손을 떼고 잠깐 여유를 준 뒤, 다시 누를 때까지 일정 간격으로 게이지가 줄어든다
  useEffect(() => {
    if (pressing || status !== "playing" || paused) return;

    let interval: ReturnType<typeof setInterval> | undefined;
    function tick() {
      decay();
      decayAtRef.current = Date.now() + DECAY_INTERVAL_MS;
    }

    // 멈추기 전 안 누르고 있었다면 남은 시간만큼만 기다린다 — 멈췄다 이어하기를 반복해도 감소를 미룰 수 없다
    const first = decayRemainingRef.current ?? DECAY_GRACE_MS;
    decayRemainingRef.current = null;
    decayAtRef.current = Date.now() + first;
    const grace = setTimeout(() => {
      tick();
      interval = setInterval(tick, DECAY_INTERVAL_MS);
    }, first);

    return () => {
      clearTimeout(grace);
      if (interval !== undefined) clearInterval(interval);
    };
  }, [pressing, status, paused]);

  // 결과 팝업 안에서 누른 것도 React 트리를 따라 올라오지만, 게임이 끝났으면 무시된다
  function startPress() {
    if (paused) return;
    if (statusRef.current === "success" || statusRef.current === "fail") return;
    if (statusRef.current === "ready") changeStatus("playing");
    setPressing(true);
  }

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (event.target instanceof HTMLElement && event.target.closest("a, button, input, textarea, select")) {
      return;
    }
    event.preventDefault();
    if (event.repeat) return;
    startPress();
  });

  const handleKeyUp = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === " " || event.key === "Enter") setPressing(false);
  });

  // 화면 밖에서 손을 떼거나 창이 포커스를 잃어도 먹기를 멈춘다
  useEffect(() => {
    const release = () => setPressing(false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, []);

  function restart() {
    statusRef.current = "ready";
    ownerRef.current = "away";
    gaugeRef.current = 0;
    setStatus("ready");
    setOwnerState("away");
    setGauge(0);
    setTrend("up");
    setPressing(false);
    setPaused(false);
    phaseEndsAtRef.current = 0;
    warningMsRef.current = 0;
    remainingRef.current = null;
    decayAtRef.current = 0;
    decayRemainingRef.current = null;
  }

  // 주인 상태는 그대로 두고 누르기만 해제한다 — 멈춘 순간의 상태·남은 시간 그대로 이어가야
  // 멈춰서 시선을 피하거나("looking"→"away") 경고를 늘리는(매번 새 경고) 꼼수가 생기지 않는다
  function pauseGame() {
    remainingRef.current = Math.max(0, phaseEndsAtRef.current - Date.now());
    // 안 누르고 있어서 게이지가 줄던 중이었다면 그 남은 시간도 이어간다 — 아니면 멈췄다 이어하기를
    // 반복해서 감소 시작을 계속 미루는(=게이지가 절대 안 줄어드는) 꼼수가 생긴다
    if (!pressing) decayRemainingRef.current = Math.max(0, decayAtRef.current - Date.now());
    setPressing(false);
    setPaused(true);
  }

  const isOver = status === "success" || status === "fail";
  const isShrinking = trend === "down" && gauge > 0;
  const pose: CapybaraPose =
    status === "fail" ? "caught" : status === "success" || pressing ? "eating" : "idle";
  // 게임 중 꾹 누르고 있으면 와구와구 씹고 접시가 들썩인다
  const munching = status === "playing" && pressing;

  return (
    <div
      data-testid="capybara-sneak-screen"
      onPointerDown={startPress}
      onContextMenu={preventDefault}
      className="relative h-dvh w-full cursor-pointer touch-none select-none overflow-hidden bg-background [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]"
    >
      <h1 className="sr-only">{GAME_TITLES["capybara-sneak"]}</h1>
      <p aria-live="polite" className="sr-only">
        {OWNER_STATUS_MESSAGE[ownerState]}
      </p>

      <SneakStage ownerState={ownerState} foodStage={getFoodStage(gauge)} pose={pose} munching={munching} />

      <div
        data-testid="gauge-panel"
        data-trend={trend}
        className="absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] mx-auto w-[min(32rem,calc(100%-8rem))] rounded-2xl bg-background/85 px-4 py-3 shadow-lg backdrop-blur"
      >
        <div className="mb-2 flex items-center justify-between text-caption-1 font-semibold text-text-strong">
          <span>먹기 게이지</span>
          <span className="flex items-center gap-2 tabular-nums">
            {isShrinking && <span className="text-caption-2 font-bold text-destructive">줄어드는 중</span>}
            {gauge}%
          </span>
        </div>
        <Progress
          value={gauge}
          size="lg"
          aria-label="먹기 게이지"
          className={cn(isShrinking && "[&>*]:bg-destructive")}
        />
        {status === "ready" && (
          <p className="mt-2 text-center text-caption-2 text-text-caption">
            주인이 안 볼 때 화면을 꾹 눌러 수박을 먹어요. 안 먹으면 게이지가 줄어요
          </p>
        )}
      </div>

      <GameControls
        pause={
          status === "playing"
            ? { paused, onPause: pauseGame, onResume: () => setPaused(false), onRestart: restart }
            : undefined
        }
      />

      <Dialog open={isOver} onOpenChange={(open) => !open && restart()}>
        <Dialog.Content showCloseButton={false} closeOnOverlayClick={false} className="text-center">
          <div className="flex flex-col items-center gap-3">
            {status === "success" ? (
              <Image
                src={`${ASSET}/capybara/capybara-eating.png`}
                alt="수박을 먹는 카피바라"
                width={1254}
                height={1254}
                className="h-40 w-auto"
              />
            ) : (
              <Image
                src={`${ASSET}/owner/owner-angry-front.png`}
                alt="허리에 손을 얹고 화난 주인"
                width={1086}
                height={1448}
                className="h-40 w-auto"
              />
            )}
            <Dialog.Title className="text-title-1 font-black">
              {status === "success" ? "다 먹었다!" : "들켰다!"}
            </Dialog.Title>
            <Dialog.Description>
              {status === "success"
                ? "주인에게 들키지 않고 수박을 다 먹었어요."
                : `주인이 보고 있을 때 먹다가 들켰어요. 게이지 ${gauge}%에서 멈췄어요.`}
            </Dialog.Description>
          </div>

          <Button type="button" onClick={restart} className="h-12 w-full text-title-3 font-bold">
            다시 하기
          </Button>

          <AdSlot placement="capybara-sneak-result" />
        </Dialog.Content>
      </Dialog>
    </div>
  );
}

export default CapybaraSneak;
