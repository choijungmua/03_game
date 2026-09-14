"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/inputs/button";
import { cn } from "@/lib";
import type { BotLevel } from "@/lib/games/rooms";

import { BOT_LEVELS } from "./constants";

interface BotPickerProps {
  pending: boolean;
  onPick(level: BotLevel): void;
}

/** "컴터랑 두기"를 누르면 고수·중수·초보가 펼쳐지고, 고르면 그 수준의 컴퓨터와 두는 방을 만든다 */
export function BotPicker({ pending, onPick }: BotPickerProps) {
  const [open, setOpen] = useState(false);
  const levelsId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={levelsId}
        onClick={() => setOpen((current) => !current)}
        className="h-12 w-full text-title-3 font-bold"
      >
        컴터랑 두기
        <ChevronDown
          aria-hidden="true"
          className={cn("size-5 transition-transform motion-reduce:transition-none", open && "rotate-180")}
        />
      </Button>
      {open && (
        <div id={levelsId} role="group" aria-label="컴퓨터 수준" className="grid grid-cols-3 gap-2">
          {BOT_LEVELS.map(({ level, label }) => (
            <Button key={level} type="button" disabled={pending} onClick={() => onPick(level)} className="h-11 font-bold">
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
