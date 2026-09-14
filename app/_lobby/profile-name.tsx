"use client";

import { UserPen } from "lucide-react";
import NextImage from "next/image";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib";
import { NAME_MAX } from "@/lib/lobby/constants";
import { cleanName } from "@/lib/lobby/presence";

import { FRAME_SRC } from "./constants";
import { CAPYBARA_SRC } from "./wardrobe";

interface ProfileNameProps {
  /** 지금 머리 위 이름표 (첫 동기화 전엔 빈 문자열) */
  name: string;
  onRename: (name: string) => void;
}

/** 오른쪽 세로 줄의 이름 바꾸기 버튼. 누르면 그 자리에서 커지며 이름 입력 창이 열린다 (낚시 가방과 같은 방식) */
export function ProfileName({ name, onRename }: ProfileNameProps) {
  const [open, setOpen] = useState(false);
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
    // z-[4]: 열린 창이 효과음 버튼 위, 낚시 가방 창(z-[5]) 아래에 그려지게
    <div className="relative z-[4] flex justify-end">
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
        // 옷장 버튼과 같은 모양: 크기(모바일 size-14, md 이상 size-18)·카피바라 얼굴·나무 테두리
        className="group relative size-14 overflow-hidden rounded-full bg-card/90 shadow-md backdrop-blur focus-visible:outline-2 focus-visible:outline-primary md:size-18"
      >
        {/* 전신 이미지를 얼굴 쪽으로 확대해 얼굴만 보이게 한다 */}
        <NextImage src={CAPYBARA_SRC} alt="" width={144} height={144} unoptimized className="size-full origin-[50%_30%] scale-[1.9]" />
        {/* 마우스를 올리거나 키보드 포커스면 얼굴 위에 이름 아이콘 */}
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-overlay text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
        >
          <UserPen className="size-7" />
        </span>
        <NextImage src={FRAME_SRC} alt="" fill unoptimized sizes="72px" draggable={false} />
      </button>

      <section
        role="dialog"
        aria-label="이름 바꾸기"
        inert={!open}
        className={cn(
          "absolute right-0 top-0 flex w-[min(18rem,calc(100vw-2rem))] origin-top-right flex-col gap-3 rounded-2xl bg-card/95 p-4 shadow-lg backdrop-blur transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-[0.15] opacity-0",
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-title-3 font-bold text-text-strong">이름 바꾸기</h2>
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="flex size-10 items-center justify-center rounded-full text-title-3 text-text-caption hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
          >
            ×
          </button>
        </div>
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
      </section>
    </div>
  );
}
