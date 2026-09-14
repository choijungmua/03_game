import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockIntersectionObserver } from "@/lib/games/testing/mock-intersection-observer";

import { CapybaraLogDodge, COUNTDOWN_STEP_MS, COUNTDOWN_VALUES } from "./capybara-log-dodge";

function gameScreen() {
  return screen.getByTestId("capybara-log-dodge-screen");
}

describe("CapybaraLogDodge 시작 화면", () => {
  beforeEach(() => {
    mockIntersectionObserver();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("도전장 링크(?vs=)로 들어오면 친구 기록을 보여준다", () => {
    window.history.replaceState({}, "", "/games/capybara-log-dodge?vs=47.3");
    render(<CapybaraLogDodge />);
    expect(screen.getByTestId("challenge-banner")).toHaveTextContent("친구 기록 47.3초");
  });

  it("잘못된 ?vs= 값이면 도전장을 띄우지 않는다", () => {
    window.history.replaceState({}, "", "/games/capybara-log-dodge?vs=hack");
    render(<CapybaraLogDodge />);
    expect(screen.queryByTestId("challenge-banner")).not.toBeInTheDocument();
  });

  it("코스 버튼은 게임을 시작하지 않고 코스만 바꾼다", () => {
    render(<CapybaraLogDodge />);
    const practice = screen.getByRole("button", { name: "연습(랜덤)" });
    fireEvent.click(practice);
    expect(practice).toHaveAttribute("aria-pressed", "true");
    expect(gameScreen()).toHaveAttribute("data-phase", "idle");
  });

  it("화면을 누르면 3·2·1 뒤에 플레이가 시작된다", async () => {
    vi.useFakeTimers();
    render(<CapybaraLogDodge />);
    fireEvent.click(gameScreen());
    expect(gameScreen()).toHaveAttribute("data-phase", "countdown");
    await act(async () => {
      vi.advanceTimersByTime(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
    });
    expect(gameScreen()).toHaveAttribute("data-phase", "playing");
    expect(document.querySelector("[data-ad-placement]")).not.toBeInTheDocument();
  });
});
