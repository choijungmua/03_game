import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockIntersectionObserver } from "@/lib/games/testing/mock-intersection-observer";

import { CapybaraPlaneShooter, COUNTDOWN_STEP_MS, COUNTDOWN_VALUES } from "./capybara-plane-shooter";

function gameScreen() {
  return screen.getByTestId("capybara-plane-shooter-screen");
}

describe("CapybaraPlaneShooter 일시정지", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockIntersectionObserver();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function startPlaying() {
    render(<CapybaraPlaneShooter />);
    fireEvent.click(gameScreen());
    await act(async () => {
      vi.advanceTimersByTime(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
    });
    expect(gameScreen()).toHaveAttribute("data-phase", "playing");
  }

  it("시작 화면에는 일시정지 버튼 없이 로비 링크만 있다", () => {
    render(<CapybaraPlaneShooter />);
    expect(screen.queryByRole("button", { name: "일시정지" })).toBeNull();
    expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
  });

  it("플레이 중 일시정지로 멈추고 이어하기로 돌아온다", async () => {
    await startPlaying();
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    expect(gameScreen()).toHaveAttribute("data-paused", "true");

    fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
    expect(gameScreen()).toHaveAttribute("data-paused", "false");
  });

  it("멈춘 상태에서 처음부터를 누르면 카운트다운부터 다시 한다", async () => {
    await startPlaying();
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    fireEvent.click(screen.getByRole("button", { name: "처음부터" }));
    expect(gameScreen()).toHaveAttribute("data-phase", "countdown");
    expect(gameScreen()).toHaveAttribute("data-paused", "false");
  });
});
