"use client";

import { type FormEvent, useEffect, useEffectEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib";
import { NAME_MAX } from "@/lib/lobby/constants";
import { cleanName } from "@/lib/lobby/presence";

import { useLobbyMenuPanel } from "./lobby-menu";

interface ProfileNameProps {
  /** 지금 머리 위 이름표 (첫 동기화 전엔 빈 문자열) */
  name: string;
  onRename: (name: string) => void;
}

/** 내 카피바라 메뉴의 이름 탭: 머리 위 이름표 바꾸기 */
export function ProfileName({ name, onRename }: ProfileNameProps) {
  const { open } = useLobbyMenuPanel("profile");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 탭이 보일 때마다 지금 이름을 채운다 (입력 중에 이름표가 바뀌어도 지우지 않게 이때만). 모바일 키보드가 튀어나오지 않게 포커스는 옮기지 않는다
  const fillName = useEffectEvent(() => {
    if (!inputRef.current) return;
    inputRef.current.value = name;
    setError("");
  });
  useEffect(() => {
    if (open) fillName();
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
    setError("");
    inputRef.current?.blur();
  };

  return (
    <section aria-label="이름 바꾸기" className="flex w-full flex-col gap-3">
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
  );
}
