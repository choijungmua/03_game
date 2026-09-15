import { useEffect } from "react";

/** 터치 드래그가 페이지 스크롤·당겨서 새로고침으로 이어지지 않게 한다 (포인터 이벤트는 그대로 들어온다) */
function preventTouchScroll(event: TouchEvent) {
  if (event.cancelable) event.preventDefault();
}

/**
 * active인 동안 페이지를 맨 위에 두고 스크롤을 막는다.
 * 게임 아래에 소개 섹션이 있어 페이지가 스크롤되므로, 플레이 중 휠·키·터치 입력에 화면이 밀리지 않게 한다
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
    // 모바일(특히 iOS Safari)은 overflow: hidden만으로는 터치 드래그 스크롤이 막히지 않는다
    document.addEventListener("touchmove", preventTouchScroll, { passive: false });
    return () => {
      html.style.overflow = previous.overflow;
      html.style.scrollbarGutter = previous.gutter;
      document.removeEventListener("touchmove", preventTouchScroll);
    };
  }, [active]);
}
