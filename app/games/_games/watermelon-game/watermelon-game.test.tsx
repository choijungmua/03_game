import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockIntersectionObserver } from "@/lib/games/testing/mock-intersection-observer";

import { COUNTDOWN_STEP_MS, COUNTDOWN_VALUES, WatermelonGame } from "./watermelon-game";

function gameScreen() {
  return screen.getByTestId("watermelon-game-screen");
}

describe("WatermelonGame", () => {
  beforeEach(() => {
    mockIntersectionObserver();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("시작 화면에 과일 합체 순서와 시작 안내가 있다", () => {
    render(<WatermelonGame />);
    expect(screen.getByRole("list", { name: "과일 합체 순서" })).toHaveTextContent("체리");
    expect(screen.getByRole("list", { name: "과일 합체 순서" })).toHaveTextContent("수박");
    expect(screen.getByText("클릭해서 시작하세요")).toBeInTheDocument();
    expect(gameScreen()).toHaveAttribute("data-phase", "idle");
  });

  it("화면을 누르면 3·2·1 뒤에 플레이가 시작되고, 플레이 중엔 광고가 없다", async () => {
    vi.useFakeTimers();
    render(<WatermelonGame />);
    fireEvent.click(gameScreen());
    expect(gameScreen()).toHaveAttribute("data-phase", "countdown");
    await act(async () => {
      vi.advanceTimersByTime(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
    });
    expect(gameScreen()).toHaveAttribute("data-phase", "playing");
    expect(screen.getByTestId("play-area")).toBeInTheDocument();
    expect(document.querySelector("[data-ad-placement]")).not.toBeInTheDocument();

    // 플레이 중 클릭은 새 판을 열지 않는다
    fireEvent.click(gameScreen());
    expect(gameScreen()).toHaveAttribute("data-phase", "playing");
  });
});
