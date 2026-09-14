import { useEffect } from "react";

/**
 * active인 동안 페이지를 맨 위에 두고 스크롤을 막는다.
 * 게임 아래에 소개 섹션이 있어 페이지가 스크롤되므로, 플레이 중 휠·키 입력에 화면이 밀리지 않게 한다
 */
export function useLockPageScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const html = document.documentElement;
    const previous = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter };
    if (window.scrollY > 0) window.scrollTo(0, 0);
    // 스크롤바가 있던 페이지는 막는 순간 스크롤바가 사라져 화면 폭이 늘고 내용이 옆으로 튄다 — 그 자리를 비워 둔다
    if (html.scrollHeight > window.innerHeight) html.style.scrollbarGutter = "stable";
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous.overflow;
      html.style.scrollbarGutter = previous.gutter;
    };
  }, [active]);
}
