import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
