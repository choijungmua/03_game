import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useLockPageScroll } from "./use-lock-page-scroll";

function touchMove() {
  const event = new Event("touchmove", { bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("useLockPageScroll", () => {
  it("켜져 있는 동안만 페이지 스크롤과 터치 드래그 스크롤을 막는다 — 모바일에서 플레이 중 화면이 밀리지 않게", () => {
    const { rerender, unmount } = renderHook(({ active }) => useLockPageScroll(active), {
      initialProps: { active: false },
    });
    expect(touchMove()).toBe(false);

    rerender({ active: true });
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(touchMove()).toBe(true);

    rerender({ active: false });
    expect(document.documentElement.style.overflow).toBe("");
    expect(touchMove()).toBe(false);

    rerender({ active: true });
    unmount();
    expect(touchMove()).toBe(false);
  });

  it("스크롤바가 숨겨진 페이지에서는 잠금 중에도 빈 스크롤바 자리를 남기지 않는다", () => {
    const html = document.documentElement;
    const scrollHeight = vi.spyOn(html, "scrollHeight", "get").mockReturnValue(window.innerHeight + 1);
    html.style.scrollbarWidth = "none";

    const { unmount } = renderHook(() => useLockPageScroll(true));

    expect(html.style.scrollbarGutter).toBe("");

    unmount();
    scrollHeight.mockRestore();
    html.style.scrollbarWidth = "";
  });
});
