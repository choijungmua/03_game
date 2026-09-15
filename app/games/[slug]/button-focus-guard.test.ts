import { describe, expect, it } from "vitest";

import { keepFocusOffButton } from "./button-focus-guard";

function mouseDownOn(target: Element) {
  const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  document.body.addEventListener("mousedown", keepFocusOffButton, { once: true });
  target.dispatchEvent(event);
  return event;
}

describe("keepFocusOffButton", () => {
  it("버튼(안의 아이콘 포함)을 마우스로 누르면 포커스를 주지 않아, 뒤이은 Space가 버튼을 다시 누르지 않는다", () => {
    document.body.innerHTML = `<button type="button"><svg></svg></button><input /><div></div>`;
    expect(mouseDownOn(document.querySelector("button")!).defaultPrevented).toBe(true);
    expect(mouseDownOn(document.querySelector("svg")!).defaultPrevented).toBe(true);
  });

  it("입력칸·빈 화면 누름은 막지 않는다 (슬라이더 드래그·글자 입력 유지)", () => {
    document.body.innerHTML = `<button type="button"></button><input /><div></div>`;
    expect(mouseDownOn(document.querySelector("input")!).defaultPrevented).toBe(false);
    expect(mouseDownOn(document.querySelector("div")!).defaultPrevented).toBe(false);
  });
});
