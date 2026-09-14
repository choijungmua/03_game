"use client";

import { ArrowLeft, Pause } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";

import { Button, buttonVariants } from "@/components/inputs/button";
import { Dialog } from "@/components/overlay/dialog";
import { cn } from "@/lib";
import { GAME_SOUNDS } from "@/lib/games/constants";
import { playGameSound } from "@/lib/lobby/settings";

import { ROUND_BUTTON } from "./constants";
import type { GameControlsProps } from "./type";

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function GameControls({ pause, onCancelRound, leaveConfirm, className }: GameControlsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // leaveConfirm이 사라지면(다음 판/상대 기권 등) 남아있던 확인 창 상태도 같이 리셋한다
  if (!leaveConfirm && confirmOpen) setConfirmOpen(false);
  const pausable = pause !== undefined;

  // 탭을 떠나 저절로 멈출 때는 들을 사람이 없으니 소리 없이 멈춘다
  function pauseWithSound() {
    playGameSound(GAME_SOUNDS.pause);
    pause?.onPause();
  }
  function resumeWithSound() {
    playGameSound(GAME_SOUNDS.resume);
    pause?.onResume();
  }
  function restartWithSound() {
    playGameSound(GAME_SOUNDS.start);
    pause?.onRestart();
  }

  // 멈춘 상태의 Esc는 멈춤 창(Radix)이 닫기 = 이어하기로 처리한다
  // defaultPrevented 체크: Radix가 이미 처리한 Esc(다른 열린 창 닫기)까지 여기서 중복으로 멈추지 않도록
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.defaultPrevented && pause && !pause.paused) pauseWithSound();
  });

  const handleVisibilityChange = useEffectEvent(() => {
    if (document.visibilityState === "hidden" && pause && !pause.paused) pause.onPause();
  });

  useEffect(() => {
    if (!pausable) return;
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pausable]);

  const backIcon = <ArrowLeft aria-hidden="true" className="size-5" />;
  const backClass = cn(ROUND_BUTTON, "left-4");

  return (
    // 창(Dialog)은 포털이지만 React 트리상 이 div 안이라, 창 내용·창 밖 오버레이 탭까지 여기서 막힌다
    <div className={cn("contents", className)} onPointerDown={stopPropagation} onClick={stopPropagation}>
      {onCancelRound ? (
        <button type="button" aria-label="이번 판 그만하기" onClick={onCancelRound} className={backClass}>
          {backIcon}
        </button>
      ) : leaveConfirm ? (
        <button type="button" aria-label="로비로 돌아가기" onClick={() => setConfirmOpen(true)} className={backClass}>
          {backIcon}
        </button>
      ) : (
        <Link href="/" aria-label="로비로 돌아가기" className={backClass}>
          {backIcon}
        </Link>
      )}

      {pause && (
        <>
          <button type="button" aria-label="일시정지" onClick={pauseWithSound} className={cn(ROUND_BUTTON, "right-4")}>
            <Pause aria-hidden="true" className="size-5" />
          </button>

          <Dialog
            open={pause.paused}
            onOpenChange={(open) => {
              if (!open) resumeWithSound();
            }}
          >
            <Dialog.Content
              showCloseButton={false}
              className="text-center"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <Dialog.Title className="text-title-1 font-black">일시정지</Dialog.Title>
              <Dialog.Description>게임을 잠깐 멈췄어요.</Dialog.Description>
              <div className="flex flex-col gap-2">
                <Button type="button" onClick={resumeWithSound} className="h-12 w-full text-title-3 font-bold">
                  이어하기
                </Button>
                <Button type="button" variant="outline" onClick={restartWithSound} className="h-12 w-full">
                  처음부터
                </Button>
                <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "h-12 w-full")}>
                  로비로
                </Link>
              </div>
            </Dialog.Content>
          </Dialog>
        </>
      )}

      {leaveConfirm && (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <Dialog.Content showCloseButton={false} className="text-center">
            <Dialog.Title className="text-title-2 font-bold">로비로 나갈까요?</Dialog.Title>
            <Dialog.Description>{leaveConfirm}</Dialog.Description>
            <div className="flex flex-col gap-2">
              <Button type="button" onClick={() => setConfirmOpen(false)} className="h-12 w-full text-title-3 font-bold">
                계속 두기
              </Button>
              <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full")}>
                나가기
              </Link>
            </div>
          </Dialog.Content>
        </Dialog>
      )}
    </div>
  );
}
