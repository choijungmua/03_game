import { useEffect } from "react";

/**
 * active인 동안 페이지를 맨 위에 두고 스크롤을 막는다.
 * 게임 아래에 소개 섹션이 있어 페이지가 스크롤되므로, 플레이 중 휠·키 입력에 화면이 밀리지 않게 한다
 */
export function useLockPageScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const html = document.documentElement;
    const previous = html.style.overflow;
    if (window.scrollY > 0) window.scrollTo(0, 0);
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, [active]);
}
