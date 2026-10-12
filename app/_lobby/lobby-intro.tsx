"use client";

import Link from "next/link";

import { Dialog } from "@/components/overlay/dialog";

export function LobbyIntro() {
  return (
    <Dialog>
      <Dialog.Trigger className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-sm text-text-strong transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
        안내
      </Dialog.Trigger>
      <Dialog.Content
        showCloseButton={false}
        className="overscroll-contain motion-reduce:animate-none"
        onKeyDown={(event) => {
          if (event.key !== "Escape" && event.key !== "Tab") event.stopPropagation();
        }}
      >
        <Dialog.Header>
          <Dialog.Title>로비 안내</Dialog.Title>
          <Dialog.Description>
            카피바라를 움직여 오두막에 들어가면 게임을 시작할 수 있어요.
            게임 목록에서 바로 고르거나 각 게임의 하는 법과 공략을 확인할 수도 있어요.
          </Dialog.Description>
        </Dialog.Header>
        <nav aria-label="사이트 안내" className="flex flex-wrap gap-4">
          <Link href="/games" className="inline-flex min-h-11 items-center rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">게임 목록·공략</Link>
          <Link href="/contact" className="inline-flex min-h-11 items-center rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">서비스 소개·문의</Link>
        </nav>
        <Dialog.Close className="min-h-11 touch-manipulation rounded-md bg-muted px-4 text-text-strong hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary">
          닫기
        </Dialog.Close>
      </Dialog.Content>
    </Dialog>
  );
}
