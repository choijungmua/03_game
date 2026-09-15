"use client";

import { ArrowLeft, Pause, Volume2, VolumeX } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { Button, buttonVariants } from "@/components/inputs/button";
import { LobbyLink } from "@/components/navigation/lobby-link";
import { Dialog } from "@/components/overlay/dialog";
import { cn } from "@/lib";
import { GAME_SOUNDS } from "@/lib/games/constants";
import { playGameSound, saveLobbySettings, toggledSound, useLobbySettings, withVolume } from "@/lib/lobby/settings";

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
  // 로비에서 정한 소리 설정을 게임 화면에서도 바꿀 수 있게 한다 (같은 저장값이라 로비에도 그대로 반영된다)
  const settings = useLobbySettings();
  const volume = settings.muted ? 0 : Math.round(settings.volume * 100);

  function toggleSound() {
    // 음량이 0으로 저장돼 있어도(로비 슬라이더를 0으로 내림) 켜면 들리는 음량으로 켜진다
    saveLobbySettings(toggledSound(settings));
    // 켰을 때만 들린다 — 방금 켠 소리가 제대로 나는지 바로 확인할 수 있게
    playGameSound(GAME_SOUNDS.tap);
  }

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
  // 가로로 든 아이폰은 왼쪽·오른쪽에 노치·다이나믹 아일랜드가 온다 — 안전 영역만큼 안쪽으로 들인다
  const backClass = cn(ROUND_BUTTON, "left-[max(1rem,env(safe-area-inset-left))]");

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
        <LobbyLink aria-label="로비로 돌아가기" className={backClass}>
          {backIcon}
        </LobbyLink>
      )}

      {/* 뒤로 버튼 바로 아래. 위쪽 양옆은 게임마다 HUD(체력·점수·게이지)가 붙어 있어서 옆에 두면 좁은 화면에서 겹친다 */}
      <button
        type="button"
        aria-label="효과음"
        aria-pressed={volume > 0}
        onClick={toggleSound}
        className={cn(ROUND_BUTTON, "left-[max(1rem,env(safe-area-inset-left))] mt-14")}
      >
        {volume > 0 ? <Volume2 aria-hidden="true" className="size-5" /> : <VolumeX aria-hidden="true" className="size-5" />}
      </button>

      {pause && (
        <>
          <button type="button" aria-label="일시정지" onClick={pauseWithSound} className={cn(ROUND_BUTTON, "right-[max(1rem,env(safe-area-inset-right))]")}>
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
              <label className="flex flex-col gap-2 text-left text-caption-1 text-text-caption">
                <span className="flex justify-between">
                  효과음 크기
                  <span className="tabular-nums text-text-strong">{volume}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={volume}
                  // 음소거 중에 음량을 올리면 소리도 같이 켜고, 0으로 내리면 끄되 직전 음량은 남긴다 (로비 음량 슬라이더와 같게)
                  onChange={(event) => saveLobbySettings(withVolume(settings, Number(event.currentTarget.value) / 100))}
                  className="h-11 w-full cursor-pointer accent-primary"
                />
              </label>
              <div className="flex flex-col gap-2">
                <Button type="button" onClick={resumeWithSound} className="h-12 w-full text-title-3 font-bold">
                  이어하기
                </Button>
                <Button type="button" variant="outline" onClick={restartWithSound} className="h-12 w-full">
                  처음부터
                </Button>
                <LobbyLink className={cn(buttonVariants({ variant: "ghost" }), "h-12 w-full")}>
                  로비로
                </LobbyLink>
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
              <LobbyLink className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full")}>
                나가기
              </LobbyLink>
            </div>
          </Dialog.Content>
        </Dialog>
      )}
    </div>
  );
}
