import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REACTION_DELAY_RANGE, ReactionTime } from "./reaction-time";

function getArea() {
  return screen.getByTestId("reaction-area");
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe("ReactionTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("초기 상태에서는 시작 안내를 보여준다", () => {
    render(<ReactionTime />);
    expect(getArea()).toHaveTextContent("클릭해서 시작");
  });

  it("시작을 클릭하면 대기 상태로 바뀐다", () => {
    render(<ReactionTime />);
    fireEvent.click(getArea());
    expect(getArea()).toHaveTextContent("기다리세요");
  });

  it("초록불이 되기 전에 클릭하면 너무 빠르다고 알려준다", () => {
    render(<ReactionTime />);
    fireEvent.click(getArea()); // idle -> waiting
    fireEvent.click(getArea()); // too soon
    expect(getArea()).toHaveTextContent("너무 빨랐어요");
  });

  it("너무 빠른 상태에서 다시 클릭하면 대기 상태로 재시작된다", () => {
    render(<ReactionTime />);
    fireEvent.click(getArea()); // idle -> waiting
    fireEvent.click(getArea()); // too soon
    fireEvent.click(getArea()); // restart -> waiting
    expect(getArea()).toHaveTextContent("기다리세요");
  });

  it("대기 시간이 지나 초록불이 되면 클릭 시 반응 시간을 ms로 보여준다", async () => {
    render(<ReactionTime />);
    fireEvent.click(getArea()); // idle -> waiting
    await advance(REACTION_DELAY_RANGE.min); // -> go
    expect(getArea()).toHaveTextContent("지금 클릭");

    await advance(250);
    fireEvent.click(getArea());

    expect(getArea()).toHaveTextContent("250");
    expect(getArea()).toHaveTextContent("ms");
  });

  it("결과 화면에서 다시 클릭하면 새 대기 사이클이 시작된다", async () => {
    render(<ReactionTime />);
    fireEvent.click(getArea());
    await advance(REACTION_DELAY_RANGE.min);
    await advance(250);
    fireEvent.click(getArea()); // -> result

    fireEvent.click(getArea()); // result -> waiting
    expect(getArea()).toHaveTextContent("기다리세요");
  });

  it("더 빠른 기록이 나오면 최고 기록이 갱신된다", async () => {
    render(<ReactionTime />);

    // 1회차: 250ms
    fireEvent.click(getArea());
    await advance(REACTION_DELAY_RANGE.min);
    await advance(250);
    fireEvent.click(getArea());
    expect(screen.getByTestId("best-score")).toHaveTextContent("250");

    // 2회차: 120ms (더 빠름 -> 갱신)
    fireEvent.click(getArea()); // result -> waiting
    await advance(REACTION_DELAY_RANGE.min);
    await advance(120);
    fireEvent.click(getArea());
    expect(screen.getByTestId("best-score")).toHaveTextContent("120");

    // 3회차: 400ms (더 느림 -> 최고 기록 유지)
    fireEvent.click(getArea());
    await advance(REACTION_DELAY_RANGE.min);
    await advance(400);
    fireEvent.click(getArea());
    expect(screen.getByTestId("best-score")).toHaveTextContent("120");
  });
});
