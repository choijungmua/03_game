"use client";

import { UserPen } from "lucide-react";
import NextImage from "next/image";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib";
import { NAME_MAX } from "@/lib/lobby/constants";
import { cleanName } from "@/lib/lobby/presence";

import { LOBBY_SIDE_PANEL, PROFILE_BUTTON_SRC } from "./constants";
import { useLobbyMenuPanel } from "./lobby-menu";
import { trapDialogFocus } from "./shortcut";

interface ProfileNameProps {
  /** 지금 머리 위 이름표 (첫 동기화 전엔 빈 문자열) */
  name: string;
  onRename: (name: string) => void;
}

/** 오른쪽 세로 줄의 이름 바꾸기 버튼. 누르면 그 자리에서 커지며 이름 입력 창이 열린다 (낚시 가방과 같은 방식) */
export function ProfileName({ name, onRename }: ProfileNameProps) {
  const { open, panelHost, setOpen } = useLobbyMenuPanel("profile");
  const [error, setError] = useState("");
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setError("");
    openButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.select();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setError("");
      openButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = cleanName(inputRef.current?.value ?? "");
    if (!next) {
      setError("이름을 한 글자 이상 적어 주세요");
      inputRef.current?.focus();
      return;
    }
    if (next !== name) onRename(next);
    close();
  };

  return (
    <div className="relative flex justify-end">
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => {
          // 열 때 한 번만 지금 이름을 채운다 (입력 중에 이름표가 바뀌어도 지우지 않게)
          if (inputRef.current) inputRef.current.value = name;
          setOpen(true);
        }}
        aria-label={name ? `이름 바꾸기 (지금 이름: ${name})` : "이름 바꾸기"}
        aria-expanded={open}
        // 옷장 버튼과 같은 크기(모바일 size-14, md 이상 size-18). 나무 테·펠트 판까지 그려진 이름표 버튼 그림
        className="group relative block size-14 rounded-full focus-visible:outline-2 focus-visible:outline-primary md:size-18"
      >
        <NextImage src={PROFILE_BUTTON_SRC} alt="" width={256} height={256} unoptimized draggable={false} className="size-full drop-shadow-md" />
        {/* 마우스를 올리거나 키보드 포커스면 나무 테 안쪽 판 위에 이름 아이콘 */}
        <span
          aria-hidden
          className="absolute inset-[16%] flex items-center justify-center rounded-full bg-overlay text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
        >
          <UserPen className="size-6 md:size-7" />
        </span>
      </button>

      {open && panelHost && createPortal(<section
        role="region"
        aria-label="이름 바꾸기"
        inert={!open}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            close();
            return;
          }
          trapDialogFocus(event, event.currentTarget);
        }}
        className={cn(
          LOBBY_SIDE_PANEL,
          "flex w-full flex-col gap-3 border-t border-border-default pt-4",
        )}
      >
        <h2 className="text-title-3 font-bold text-text-strong">이름 바꾸기</h2>
        <form onSubmit={submit} noValidate className="flex flex-col gap-2">
          <label htmlFor="lobby-profile-name" className="text-caption-1 text-text-caption">
            머리 위에 보일 이름 ({NAME_MAX}글자까지)
          </label>
          <input
            ref={inputRef}
            id="lobby-profile-name"
            name="nickname"
            autoComplete="nickname"
            spellCheck={false}
            enterKeyHint="done"
            maxLength={NAME_MAX * 4}
            placeholder="예: 보리바라…"
            aria-invalid={error !== ""}
            aria-describedby="lobby-profile-name-help"
            // 모바일 확대를 막으려고 16px(text-base)
            className="h-11 w-full min-w-0 rounded-lg border border-border-default bg-background px-3 text-base text-text-strong placeholder:text-text-placeholder focus-visible:outline-2 focus-visible:outline-primary"
          />
          <p id="lobby-profile-name-help" aria-live="polite" className={cn("text-caption-2", error ? "text-destructive" : "text-text-caption")}>
            {error || "지금 접속 중인 친구와 같은 이름은 쓸 수 없어요"}
          </p>
          <Button type="submit" className="mt-1 h-11">
            저장
          </Button>
        </form>
      </section>, panelHost)}
    </div>
  );
}
