"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

import { cameFromLobby } from "./lobby-return";

type LobbyLinkProps = Omit<ComponentProps<typeof Link>, "href">;

/**
 * 로비(/)로 가는 링크. 로비에서 바로 들어온 페이지면 새 기록을 쌓지 않고 브라우저 뒤로 가기로 돌아간다.
 * 쌓으면 기록이 로비 → 게임 → 로비가 되어, 로비에서 뒤로 가기(모바일 뒤로 제스처)가 방금 나온 게임으로 다시 들어간다
 */
export function LobbyLink({ onClick, ...props }: LobbyLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    // 새 탭·새 창으로 여는 클릭은 링크 그대로 둔다
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!cameFromLobby()) return;
    event.preventDefault();
    window.history.back();
  };

  return <Link href="/" {...props} onClick={handleClick} />;
}
