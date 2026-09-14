"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { Progress } from "@/components/feedback/progress";
import { Button } from "@/components/inputs/button";
import { Dialog } from "@/components/overlay/dialog";
import { cn } from "@/lib";

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

export function CapybaraSneak() {
  const [status, setStatus] = useState<GameStatus>("ready");
  const [ownerState, setOwnerState] = useState<OwnerState>("away");
  const [gauge, setGauge] = useState(0);
  const [trend, setTrend] = useState<GaugeTrend>("up");
  const [pressing, setPressing] = useState(false);

  // 먹기·감소·주인 타이머는 화면이 다시 그려지기 전에도 여러 번 돌 수 있어서,
  // 판정은 렌더링 결과 대신 항상 최신 값을 담은 ref로 한다
  const statusRef = useRef<GameStatus>("ready");
  const ownerRef = useRef<OwnerState>("away");
  const gaugeRef = useRef(0);

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
    if (status !== "playing") return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    function scheduleAway() {
      const awayMs = pickDuration(AWAY_MS_RANGE);
      const warningMs = Math.min(awayMs, pickWarningMs(gaugeRef.current));
      timers.push(setTimeout(() => moveOwner("turning"), awayMs - warningMs));
      timers.push(
        setTimeout(() => {
          moveOwner("looking");
          const look = pickLook();
          timers.push(
            setTimeout(() => {
              moveOwner("away");
              scheduleAway();
            }, look.ms),
          );
        }, awayMs),
      );
    }

    scheduleAway();
    return () => timers.forEach(clearTimeout);
  }, [status]);

  // 누르고 딜레이가 지나면 첫 입, 그 뒤로는 손을 뗄 때까지 일정 간격으로 한 입씩 먹는다
  useEffect(() => {
    if (!pressing || status !== "playing") return;

    let interval: ReturnType<typeof setInterval> | undefined;
    const delay = setTimeout(() => {
      bite();
      interval = setInterval(bite, EAT_INTERVAL_MS);
    }, EAT_DELAY_MS);

    return () => {
      clearTimeout(delay);
      if (interval !== undefined) clearInterval(interval);
    };
  }, [pressing, status]);

  // 손을 떼고 잠깐 여유를 준 뒤, 다시 누를 때까지 일정 간격으로 게이지가 줄어든다
  useEffect(() => {
    if (pressing || status !== "playing") return;

    let interval: ReturnType<typeof setInterval> | undefined;
    const grace = setTimeout(() => {
      decay();
      interval = setInterval(decay, DECAY_INTERVAL_MS);
    }, DECAY_GRACE_MS);

    return () => {
      clearTimeout(grace);
      if (interval !== undefined) clearInterval(interval);
    };
  }, [pressing, status]);

  // 결과 팝업 안에서 누른 것도 React 트리를 따라 올라오지만, 게임이 끝났으면 무시된다
  function startPress() {
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
  }

  const foodStage = getFoodStage(gauge);
  const ownerImage = ownerState === "looking" ? "looking" : "away";
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
      <h1 className="sr-only">카피바라 몰래 먹기</h1>
      <p aria-live="polite" className="sr-only">
        {OWNER_STATUS_MESSAGE[ownerState]}
      </p>

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

      <div
        data-testid="gauge-panel"
        data-trend={trend}
        className="absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] mx-auto w-[min(32rem,calc(100%-2rem))] rounded-2xl bg-background/85 px-4 py-3 shadow-lg backdrop-blur"
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
