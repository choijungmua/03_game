"use client";

import { useEffect } from "react";

/** 버튼 위 마우스 누름이면 포커스를 주지 않는다 */
export function keepFocusOffButton(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest("button")) event.preventDefault();
}

/**
 * 게임 화면에서 마우스로 누른 버튼(효과음·코스 선택·공유 등)에 포커스가 남으면, 그 뒤 Space·Enter가
 * 게임 입력(점프·시작·먹기) 대신 그 버튼을 다시 누른다. 마우스 누름으로는 버튼에 포커스를 주지 않는다 — click은 그대로, Tab 포커스도 그대로
 */
export function ButtonFocusGuard() {
  useEffect(() => {
    document.addEventListener("mousedown", keepFocusOffButton);
    return () => document.removeEventListener("mousedown", keepFocusOffButton);
  }, []);
  return null;
}
