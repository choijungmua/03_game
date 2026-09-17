import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockIntersectionObserver } from "@/lib/games/testing/mock-intersection-observer";

import { CapybaraPang, COUNTDOWN_STEP_MS, COUNTDOWN_VALUES } from "./capybara-pang";
import { ROUND_SECONDS } from "./constants";
import { type Board, findMove, isValidSwap } from "./logic";

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function getScreenEl() {
  return screen.getByTestId("capybara-pang-screen");
}

/** 화면의 블록들을 칸 순서대로 읽어 판으로 되돌린다 */
function readBoard(): { board: Board; elements: HTMLElement[] } {
  const elements = [...screen.getAllByTestId("pang-tile")].sort(
    (a, b) => Number(a.dataset.cell) - Number(b.dataset.cell),
  );
  const board = elements.map((element, index) => ({
    id: index,
    kind: Number(element.dataset.kind),
    special: element.dataset.special === "bomb" ? "bomb" : element.dataset.special === "rainbow" ? "rainbow" : "none",
  }) satisfies Board[number]);
  return { board, elements };
}

function tap(element: HTMLElement) {
  fireEvent.pointerDown(element, { clientX: 0, clientY: 0 });
  fireEvent.pointerUp(element, { clientX: 0, clientY: 0 });
}

async function startPlaying() {
  fireEvent.click(getScreenEl());
  await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
}

describe("CapybaraPang", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockIntersectionObserver();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("카운트다운 뒤 7×7 판이 나오고, 둘 수 있는 수를 탭-탭으로 두면 점수가 오른다", async () => {
    render(<CapybaraPang />);
    await startPlaying();

    expect(getScreenEl()).toHaveAttribute("data-phase", "playing");
    const { board, elements } = readBoard();
    expect(elements).toHaveLength(49);

    const move = findMove(board);
    expect(move).not.toBeNull();
    const [a, b] = move ?? [0, 1];
    tap(elements[a]);
    tap(elements[b]);
    await advance(3000);

    expect(Number(screen.getByTestId("play-score").textContent?.replace(/,/g, ""))).toBeGreaterThan(0);
  });

  it("줄이 안 생기는 바꾸기는 제자리로 돌아오고 점수가 그대로다", async () => {
    render(<CapybaraPang />);
    await startPlaying();

    const { board, elements } = readBoard();
    const invalid = [0, 1, 2, 3, 4, 5].find((index) => !isValidSwap(board, index, index + 1));
    if (invalid === undefined) return; // 첫 줄이 전부 유효한 수인 드문 판
    const before = elements.map((element) => element.dataset.kind);
    tap(elements[invalid]);
    tap(elements[invalid + 1]);
    await advance(1000);

    expect(readBoard().elements.map((element) => element.dataset.kind)).toEqual(before);
    expect(screen.getByTestId("play-score")).toHaveTextContent("0");
  });

  it("60초가 지나면 결과 화면에 점수·등급이 나오고 기록이 저장된다", async () => {
    render(<CapybaraPang />);
    await startPlaying();

    const { board, elements } = readBoard();
    const [a, b] = findMove(board) ?? [0, 1];
    tap(elements[a]);
    tap(elements[b]);
    await advance(ROUND_SECONDS * 1000);

    expect(getScreenEl()).toHaveAttribute("data-phase", "result");
    expect(screen.getByTestId("result-tier")).not.toBeEmptyDOMElement();
    expect(screen.getByTestId("result-rank")).toHaveTextContent("1위");
    const saved: { score?: number }[] = JSON.parse(window.localStorage.getItem("capybara-pang-records") ?? "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].score).toBeGreaterThan(0);
  });
});
