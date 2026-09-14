import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockIntersectionObserver } from "@/lib/games/testing/mock-intersection-observer";

import { COUNTDOWN_STEP_MS, COUNTDOWN_VALUES, ReactionTime } from "./reaction-time";

function getArea() {
  return screen.getByTestId("reaction-area");
}

// 실제 탭처럼 pointerdown -> click 순서로 발생시킨다
function tap() {
  fireEvent.pointerDown(getArea());
  fireEvent.click(getArea());
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function startAndFinishCountdown() {
  tap();
  await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
}

async function playRound(reactionMs: number) {
  await startAndFinishCountdown();
  await advance(reactionMs);
  tap();
}

function getLeaderboardRows() {
  const table = screen.getByRole("table");
  return within(table).getAllByRole("row").slice(1);
}

function getAdSlot() {
  return document.querySelector("[data-ad-placement]");
}

describe("ReactionTime", () => {
  let setRecordsVisible: (visible: boolean) => Promise<void>;

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    setRecordsVisible = mockIntersectionObserver();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("플레이 중 스크롤", () => {
    it("카운트다운·측정 중에는 페이지 스크롤과 브라우저 터치 제스처를 막고, 결과 화면에서 풀린다 — 누르다 화면이 밀리지 않게", async () => {
      render(<ReactionTime />);
      expect(getArea()).toHaveClass("touch-manipulation");

      tap();
      expect(document.documentElement.style.overflow).toBe("hidden");
      expect(getArea()).toHaveClass("touch-none");

      await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
      expect(getArea()).toHaveAttribute("data-phase", "running");
      expect(document.documentElement.style.overflow).toBe("hidden");

      await advance(200);
      tap();
      expect(getArea()).toHaveAttribute("data-phase", "result");
      expect(document.documentElement.style.overflow).toBe("");
      expect(getArea()).toHaveClass("touch-manipulation");
    });
  });

  describe("시작 화면", () => {
    it("가운데에 시작 안내를 보여준다", () => {
      render(<ReactionTime />);
      expect(getArea()).toHaveAttribute("data-phase", "idle");
      expect(screen.getByText("클릭해서 시작하세요")).toBeInTheDocument();
    });

    it("시작 안내 아래에 5칸짜리 순위표를 보여준다", () => {
      render(<ReactionTime />);
      const rows = getLeaderboardRows();
      expect(rows).toHaveLength(5);
      expect(rows[0]).toHaveTextContent("1");
      expect(rows[0]).toHaveTextContent("-");
    });

    it("등급 기준을 색상별로 보여준다", () => {
      render(<ReactionTime />);
      expect(screen.getByText("프로게이머")).toBeInTheDocument();
      expect(screen.getByText("정상인")).toBeInTheDocument();
      expect(screen.getByText("150ms 미만")).toBeInTheDocument();
    });

    it("광고는 보이지 않는다", () => {
      render(<ReactionTime />);
      expect(getAdSlot()).toBeNull();
    });
  });

  describe("뒤로 버튼", () => {
    function cancelButton() {
      return screen.getByRole("button", { name: "이번 판 그만하기" });
    }

    it("시작 화면에서는 로비로 가는 링크다", () => {
      render(<ReactionTime />);
      expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
    });

    it("카운트다운 중 누르면 판을 취소하고 시작 화면으로 돌아간다", async () => {
      render(<ReactionTime />);
      tap();
      fireEvent.pointerDown(cancelButton());
      fireEvent.click(cancelButton());
      expect(getArea()).toHaveAttribute("data-phase", "idle");

      await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
      expect(getArea()).toHaveAttribute("data-phase", "idle");
    });

    it("측정 중 누르면 기록을 남기지 않고 시작 화면으로 돌아간다", async () => {
      render(<ReactionTime />);
      await startAndFinishCountdown();
      fireEvent.pointerDown(cancelButton());
      fireEvent.click(cancelButton());
      expect(getArea()).toHaveAttribute("data-phase", "idle");
      expect(window.localStorage.getItem("reaction-time-records")).toBeNull();
    });

    it("너무 빨랐어요 화면에서는 로비로 가는 링크다", () => {
      render(<ReactionTime />);
      tap();
      tap();
      expect(getArea()).toHaveAttribute("data-phase", "too-soon");
      expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
    });
  });

  describe("카운트다운", () => {
    it("탭하면 전체 화면이 초록색으로 바뀌고 3부터 센다", () => {
      render(<ReactionTime />);
      tap();
      expect(getArea()).toHaveAttribute("data-phase", "countdown");
      expect(getArea()).toHaveClass("bg-success");
      expect(screen.getByTestId("countdown")).toHaveTextContent("3");
    });

    it("3 → 2 → 1 순서로 넘어간다", async () => {
      render(<ReactionTime />);
      tap();
      await advance(COUNTDOWN_STEP_MS);
      expect(screen.getByTestId("countdown")).toHaveTextContent("2");
      await advance(COUNTDOWN_STEP_MS);
      expect(screen.getByTestId("countdown")).toHaveTextContent("1");
    });

    it("카운트다운 중에 탭하면 너무 빠르다고 알려준다", async () => {
      render(<ReactionTime />);
      tap();
      await advance(COUNTDOWN_STEP_MS);
      tap();
      expect(getArea()).toHaveAttribute("data-phase", "too-soon");
      expect(getArea()).toHaveTextContent("너무 빨랐어요");
    });

    it("너무 빠른 화면에서 다시 탭하면 카운트다운이 다시 시작된다", async () => {
      render(<ReactionTime />);
      tap();
      tap();
      tap();
      expect(screen.getByTestId("countdown")).toHaveTextContent("3");
    });

    it("카운트다운 중에는 광고가 보이지 않는다", () => {
      render(<ReactionTime />);
      tap();
      expect(getAdSlot()).toBeNull();
    });
  });

  describe("측정", () => {
    it("1이 끝나면 초록 화면에서 0ms부터 화면 프레임마다 올라간다", async () => {
      render(<ReactionTime />);
      await startAndFinishCountdown();
      expect(getArea()).toHaveAttribute("data-phase", "running");
      expect(getArea()).toHaveClass("bg-success");
      expect(screen.getByTestId("timer")).toHaveTextContent("0");

      // 가짜 타이머의 requestAnimationFrame은 16ms마다 돈다
      await advance(48);
      expect(screen.getByTestId("timer")).toHaveTextContent("48");
      expect(getAdSlot()).toBeNull();
    });

    it("탭하면 멈추고 기록과 등급을 보여준다", async () => {
      render(<ReactionTime />);
      await playRound(180);

      expect(getArea()).toHaveAttribute("data-phase", "result");
      expect(screen.getByTestId("result-ms")).toHaveTextContent("180");
      expect(screen.getByTestId("result-tier")).toHaveTextContent(/^게이머$/);
    });

    it("결과 화면 배경색은 등급 색을 따른다", async () => {
      render(<ReactionTime />);
      await playRound(120);
      expect(screen.getByTestId("result-tier")).toHaveTextContent("프로게이머");
      expect(getArea()).toHaveClass("bg-violet-600");
    });

    it("결과 화면에서만 광고가 보인다", async () => {
      render(<ReactionTime />);
      await playRound(180);
      expect(getAdSlot()).not.toBeNull();
    });

    it("결과를 멈춘 탭이 곧바로 재시작으로 이어지지 않는다", async () => {
      render(<ReactionTime />);
      await playRound(180);
      await advance(COUNTDOWN_STEP_MS);
      expect(getArea()).toHaveAttribute("data-phase", "result");
    });

    it("결과 화면에서 다시 탭하면 카운트다운이 시작된다", async () => {
      render(<ReactionTime />);
      await playRound(180);
      tap();
      expect(screen.getByTestId("countdown")).toHaveTextContent("3");
    });
  });

  describe("순위표", () => {
    it("기록을 빠른 순서로 1위, 2위에 올리고 순위를 알려준다", async () => {
      render(<ReactionTime />);

      await playRound(180);
      expect(screen.getByTestId("result-rank")).toHaveTextContent("1위");

      await playRound(120);
      expect(screen.getByTestId("result-rank")).toHaveTextContent("1위");

      const rows = getLeaderboardRows();
      expect(rows[0]).toHaveTextContent("120ms");
      expect(rows[1]).toHaveTextContent("180ms");
    });

    it("느린 기록은 그 순위를 알려준다", async () => {
      render(<ReactionTime />);
      await playRound(120);
      await playRound(300);
      expect(screen.getByTestId("result-rank")).toHaveTextContent("2위");
    });

    it("새로고침해도 순위표가 남아 있다", async () => {
      const { unmount } = render(<ReactionTime />);
      await playRound(210);
      unmount();

      render(<ReactionTime />);
      expect(getLeaderboardRows()[0]).toHaveTextContent("210ms");
    });
  });

  describe("공유", () => {
    function queryShareButton() {
      return screen.queryByRole("button", { name: "공유하기" });
    }

    it("시작 화면과 결과 화면에 공유 버튼이 있다", async () => {
      render(<ReactionTime />);
      expect(queryShareButton()).not.toBeNull();

      await playRound(180);
      expect(queryShareButton()).not.toBeNull();
    });

    it("카운트다운과 측정 중에는 공유 버튼이 없다", async () => {
      render(<ReactionTime />);
      tap();
      expect(queryShareButton()).toBeNull();

      await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
      expect(queryShareButton()).toBeNull();
    });

    it("결과 화면에서 공유 버튼을 눌러도 다시 시작되지 않는다", async () => {
      render(<ReactionTime />);
      await playRound(180);

      const share = screen.getByRole("button", { name: "공유하기" });
      fireEvent.pointerDown(share);
      fireEvent.click(share);

      expect(getArea()).toHaveAttribute("data-phase", "result");
    });
  });

  describe("결과 요약과 공유 문구", () => {
    it("몇 위인지만 보여준다", async () => {
      render(<ReactionTime />);
      await playRound(180);
      expect(screen.getByTestId("result-rank").textContent).toBe("1위");
    });

    it("표에 보이는 5위 밖이어도 순위를 숫자로만 보여준다", async () => {
      render(<ReactionTime />);
      for (const ms of [100, 120, 140, 160, 180, 200]) {
        await playRound(ms);
      }
      expect(screen.getByTestId("result-rank").textContent).toBe("6위");
      expect(screen.queryByText(/순위권/)).toBeNull();
    });

    it("마지막에 등급, 기록, 설명을 한 줄로 보여준다", async () => {
      render(<ReactionTime />);
      await playRound(83);
      expect(screen.getByTestId("result-summary").textContent).toBe(
        "프로게이머 83ms, 프로 선수급 반사신경이에요",
      );
    });

    it("공유할지 묻는 문구를 공유 버튼과 함께 보여준다", async () => {
      render(<ReactionTime />);
      await playRound(180);
      const prompt = screen.getByText("이 기록을 친구에게 공유할까요?");
      expect(prompt.parentElement).toContainElement(screen.getByRole("button", { name: "공유하기" }));
    });

    it("공유 문구를 눌러도 다시 시작되지 않는다", async () => {
      render(<ReactionTime />);
      await playRound(180);
      const prompt = screen.getByText("이 기록을 친구에게 공유할까요?");
      fireEvent.pointerDown(prompt);
      fireEvent.click(prompt);
      expect(getArea()).toHaveAttribute("data-phase", "result");
    });
  });

  describe("스크롤하면 나오는 순위 기록", () => {
    it("처음에는 순위 기록이 가려져 있고 배경은 등급 색이다", async () => {
      render(<ReactionTime />);
      await playRound(120);
      expect(screen.getByTestId("result-records")).toHaveAttribute("data-visible", "false");
      expect(getArea()).toHaveClass("bg-violet-600");
    });

    it("스크롤해서 순위 기록이 보이면 배경이 바뀌고 목록이 나타난다", async () => {
      render(<ReactionTime />);
      await playRound(120);
      await setRecordsVisible(true);

      expect(screen.getByTestId("result-records")).toHaveAttribute("data-visible", "true");
      expect(getArea()).toHaveClass("bg-background");
      expect(getArea()).not.toHaveClass("bg-violet-600");
    });

    it("다시 위로 올리면 등급 색으로 돌아온다", async () => {
      render(<ReactionTime />);
      await playRound(120);
      await setRecordsVisible(true);
      await setRecordsVisible(false);

      expect(screen.getByTestId("result-records")).toHaveAttribute("data-visible", "false");
      expect(getArea()).toHaveClass("bg-violet-600");
    });

    it("순위 기록 영역을 눌러도 다시 시작되지 않는다", async () => {
      render(<ReactionTime />);
      await playRound(120);
      await setRecordsVisible(true);

      const records = screen.getByTestId("result-records");
      fireEvent.pointerDown(records);
      fireEvent.click(records);
      expect(getArea()).toHaveAttribute("data-phase", "result");
    });

    it("다음 판 결과는 순위 기록이 가려진 상태로 시작한다", async () => {
      render(<ReactionTime />);
      await playRound(120);
      await setRecordsVisible(true);
      await playRound(180);

      expect(screen.getByTestId("result-records")).toHaveAttribute("data-visible", "false");
      expect(getArea()).toHaveClass("bg-primary");
    });
  });
});
