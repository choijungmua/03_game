import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockIntersectionObserver } from "@/lib/games/testing/mock-intersection-observer";

import { CapybaraPang, COUNTDOWN_STEP_MS, COUNTDOWN_VALUES } from "./capybara-pang";
import { HINT_DELAY_MS, HURRY_SECONDS, ROUND_SECONDS, SWAP_MS } from "./constants";
import { type Board, findMove, isValidSwap } from "./logic";
import { PangHud } from "./pang-hud";

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
    expect(screen.getByRole("heading", { name: "바라매치" })).toBeInTheDocument();
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
    expect(screen.getByTestId("score-gain")).toHaveTextContent(/^\+[\d,]+$/);
  });

  it("일정 시간 조작이 없으면 계산된 수를 문구와 함께 알려준다", async () => {
    render(<CapybaraPang />);
    await startPlaying();

    expect(screen.queryByText("힌트: 흰 테두리의 두 친구를 서로 바꿔 보세요")).not.toBeInTheDocument();
    await advance(HINT_DELAY_MS);

    expect(screen.getByText("힌트: 흰 테두리의 두 친구를 서로 바꿔 보세요")).toBeInTheDocument();
    expect(document.querySelectorAll(".ring-4.ring-white")).toHaveLength(2);
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

  it("마지막 10초엔 시간 막대가 서두르기 모드가 된다", async () => {
    render(<CapybaraPang />);
    await startPlaying();

    expect(screen.getByTestId("play-timer")).not.toHaveAttribute("data-hurry");
    await advance((ROUND_SECONDS - HURRY_SECONDS) * 1000 + 50);
    expect(screen.getByTestId("play-timer")).toHaveAttribute("data-hurry", "true");
  });

  it("60초가 지나면 타임 오버 → 라스트 팡을 거쳐 결과 화면에 점수·등급이 나오고 기록이 저장된다", async () => {
    render(<CapybaraPang />);
    await startPlaying();

    const { board, elements } = readBoard();
    const [a, b] = findMove(board) ?? [0, 1];
    tap(elements[a]);
    tap(elements[b]);
    await advance(ROUND_SECONDS * 1000);

    // 곧바로 결과가 아니라 "타임 오버!"부터 (판에 남은 폭탄·무지개가 있으면 이어서 라스트 팡)
    expect(getScreenEl()).toHaveAttribute("data-phase", "lastpang");
    expect(screen.getByTestId("pang-banner")).toHaveTextContent("타임 오버!");
    await advance(30_000);

    expect(getScreenEl()).toHaveAttribute("data-phase", "result");
    expect(screen.getByTestId("result-tier")).not.toBeEmptyDOMElement();
    expect(screen.getByTestId("result-rank")).toHaveTextContent("1위");
    const saved: { score?: number }[] = JSON.parse(window.localStorage.getItem("capybara-pang-records") ?? "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].score).toBeGreaterThan(0);
  });

  it("결과의 네 점수 구성 합계가 최종 점수와 정확히 일치한다", async () => {
    render(<CapybaraPang />);
    await startPlaying();

    const { board, elements } = readBoard();
    const [a, b] = findMove(board) ?? [0, 1];
    tap(elements[a]);
    tap(elements[b]);
    await advance(ROUND_SECONDS * 1000 + 30_000);

    const breakdown = ["base", "combo", "special", "time"].map((component) =>
      Number(screen.getByTestId(`result-score-${component}`).textContent?.replace(/[^\d-]/g, "")),
    );
    expect(breakdown.reduce((sum, points) => sum + points, 0)).toBe(
      Number(screen.getByTestId("result-score").textContent?.replace(/,/g, "")),
    );
  });

  it("점수를 얻지 못한 라스트 팡도 네 점수 구성 요소가 모두 0으로 남는다", async () => {
    render(<CapybaraPang />);
    await startPlaying();
    await advance(ROUND_SECONDS * 1000);

    expect(getScreenEl()).toHaveAttribute("data-phase", "lastpang");
    await advance(30_000);

    expect(getScreenEl()).toHaveAttribute("data-phase", "result");
    expect(screen.getByTestId("result-score")).toHaveTextContent("0");
    expect(screen.getByText("기본 점수")).toBeInTheDocument();
    expect(screen.getByText("콤보 보너스")).toBeInTheDocument();
    expect(screen.getByText("특수 블록 보너스")).toBeInTheDocument();
    expect(screen.getByText("시간 보너스")).toBeInTheDocument();
    expect(screen.getByTestId("result-score-base")).toHaveTextContent("0");
    expect(screen.getByTestId("result-score-combo")).toHaveTextContent("0");
    expect(screen.getByTestId("result-score-special")).toHaveTextContent("0");
    expect(screen.getByTestId("result-score-time")).toHaveTextContent("0");
  });

it("시간 보상은 게임 안에서 900ms 뒤에 스스로 사라진다", async () => {
  let randomState = 4_294_967_291;
  const random = vi.spyOn(Math, "random").mockImplementation(() => {
    randomState = (randomState * 1_664_525 + 1_013_904_223) >>> 0;
    return randomState / 2 ** 32;
  });

  try {
    render(<CapybaraPang />);
    await startPlaying();

    for (let clear = 0; clear < 4; clear += 1) {
      const { board, elements } = readBoard();
      const move = findMove(board);
      expect(move).not.toBeNull();
      const [first, second] = move ?? [0, 1];
      tap(elements[first]);
      tap(elements[second]);
      await advance(1_000);
    }

    const { board, elements } = readBoard();
    const move = findMove(board);
    expect(move).not.toBeNull();
    const [first, second] = move ?? [0, 1];
    tap(elements[first]);
    tap(elements[second]);
    await advance(SWAP_MS + 10);

    expect(screen.getByTestId("time-gain")).toHaveTextContent("+1초 · 연속 콤보");
    expect(screen.getByTestId("time-gain")).toHaveAttribute("aria-live", "polite");

    await advance(899);
    expect(screen.getByTestId("time-gain")).toBeInTheDocument();
    await advance(1);
    expect(screen.queryByTestId("time-gain")).not.toBeInTheDocument();
  } finally {
    random.mockRestore();
  }
});

it("시간 보상은 콤보와 특수 블록 이유를 함께 읽을 수 있게 표시한다", () => {
  const { rerender } = render(
    <PangHud
      timer={<span>60.0초</span>}
      score={0}
      scoreGain={null}
      timeGain={{ id: 1, seconds: 1, reasons: ["combo"] }}
      combo={0}
      fever={false}
      lastBonus={0}
    />,
  );

  expect(screen.getByTestId("time-gain")).toHaveTextContent("+1초 · 연속 콤보");

  rerender(
    <PangHud
      timer={<span>60.0초</span>}
      score={0}
      scoreGain={null}
      timeGain={{ id: 2, seconds: 2, reasons: ["special", "combo"] }}
      combo={0}
      fever={false}
      lastBonus={0}
    />,
  );

  expect(screen.getByTestId("time-gain")).toHaveTextContent("+2초 · 특수 블록 · 연속 콤보");
});
});
