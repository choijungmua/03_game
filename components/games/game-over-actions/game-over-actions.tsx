"use client";

import { House, RotateCcw } from "lucide-react";

import { Button, buttonVariants } from "@/components/inputs/button";
import { LobbyLink } from "@/components/navigation/lobby-link";
import { cn } from "@/lib";
import { GAME_SOUNDS } from "@/lib/games/constants";
import { playGameSound } from "@/lib/lobby/settings";

import type { GameOverActionsProps } from "./type";

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

/** 게임이 끝난 화면의 다시 하기 + 홈으로. 누른 동작이 뒤의 게임 화면(탭해서 시작)으로 새지 않게 막는다 */
export function GameOverActions({ onRetry, className }: GameOverActionsProps) {
  return (
    <div
      className={cn("flex w-full cursor-default flex-col gap-2", className)}
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
    >
      <Button
        type="button"
        onClick={() => {
          playGameSound(GAME_SOUNDS.tap);
          onRetry();
        }}
        className="h-12 w-full text-title-3 font-bold"
      >
        <RotateCcw aria-hidden="true" className="size-5" />
        다시 하기
      </Button>
      <LobbyLink className={cn(buttonVariants({ variant: "ghost" }), "h-12 w-full")}>
        <House aria-hidden="true" className="size-5" />
        홈으로
      </LobbyLink>
    </div>
  );
}
