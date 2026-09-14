import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockIntersectionObserver } from "@/lib/games/testing/mock-intersection-observer";

import {
  ClickSpeed,
  COUNTDOWN_STEP_MS,
  COUNTDOWN_VALUES,
  IDLE_STOP_MS,
} from "./click-speed";

function getScreenEl() {
  return screen.getByTestId("click-speed-screen");
}

// 실제 탭처럼 pointerdown -> click 순서로 발생시킨다
function press() {
  fireEvent.pointerDown(getScreenEl(), { clientX: 120, clientY: 80 });
  fireEvent.click(getScreenEl(), { clientX: 120, clientY: 80 });
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function startPlaying() {
  press();
  await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
}

async function tapTimes(times: number, intervalMs: number) {
  for (let i = 0; i < times; i += 1) {
    if (i > 0) await advance(intervalMs);
    press();
  }
}

async function playRound(times: number, intervalMs: number) {
  await startPlaying();
  await tapTimes(times, intervalMs);
  await advance(IDLE_STOP_MS);
}

function getLeaderboardRows() {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1);
}

function getAdSlot() {
  return document.querySelector("[data-ad-placement]");
}

describe("ClickSpeed", () => {
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

  describe("시작 화면", () => {
    it("제목과 가운데 시작 안내를 보여준다", () => {
      render(<ClickSpeed />);
      expect(getScreenEl()).toHaveAttribute("data-phase", "idle");
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("클릭 스피드 테스트");
      expect(screen.getByText("클릭해서 시작하세요")).toBeInTheDocument();
    });

    it("시작 안내 아래에 5칸짜리 순위표와 등급 기준을 보여준다", () => {
      render(<ClickSpeed />);
      expect(getLeaderboardRows()).toHaveLength(5);
      expect(screen.getByText("프로게이머")).toBeInTheDocument();
      expect(screen.getByText("10회/초 이상")).toBeInTheDocument();
    });

    it("광고는 보이지 않는다", () => {
      render(<ClickSpeed />);
      expect(getAdSlot()).toBeNull();
    });
  });

  describe("카운트다운", () => {
    it("탭하면 전체 화면이 초록색으로 바뀌고 3부터 센다", () => {
      render(<ClickSpeed />);
      press();
      expect(getScreenEl()).toHaveAttribute("data-phase", "countdown");
      expect(getScreenEl()).toHaveClass("bg-success");
      expect(screen.getByTestId("countdown")).toHaveTextContent("3");
    });

    it("3 → 2 → 1 순서로 넘어간다", async () => {
      render(<ClickSpeed />);
      press();
      await advance(COUNTDOWN_STEP_MS);
      expect(screen.getByTestId("countdown")).toHaveTextContent("2");
      await advance(COUNTDOWN_STEP_MS);
      expect(screen.getByTestId("countdown")).toHaveTextContent("1");
    });

    it("카운트다운 중 탭은 세지 않는다", async () => {
      render(<ClickSpeed />);
      press();
      press();
      press();
      await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
      expect(screen.getByTestId("count")).toHaveTextContent("0");
    });

    it("카운트다운 중에는 광고가 보이지 않는다", () => {
      render(<ClickSpeed />);
      press();
      expect(getAdSlot()).toBeNull();
    });
  });

  describe("플레이", () => {
    it("1이 끝나면 초록 화면 가운데에 0부터 숫자 하나만 보여준다", async () => {
      render(<ClickSpeed />);
      await startPlaying();
      expect(getScreenEl()).toHaveAttribute("data-phase", "playing");
      expect(getScreenEl()).toHaveClass("bg-success");
      expect(screen.getByTestId("count")).toHaveTextContent("0");
      expect(getAdSlot()).toBeNull();
    });

    it("탭할 때마다 숫자가 올라가고 누른 위치에 원이 퍼진다", async () => {
      render(<ClickSpeed />);
      await startPlaying();

      press();
      expect(screen.getByTestId("count")).toHaveTextContent("1");
      expect(screen.getAllByTestId("ripple")).toHaveLength(1);

      press();
      expect(screen.getByTestId("count")).toHaveTextContent("2");
    });

    it("멈추지 않고 계속 탭하면 플레이가 이어진다", async () => {
      render(<ClickSpeed />);
      await startPlaying();
      await tapTimes(3, IDLE_STOP_MS - 500);
      expect(getScreenEl()).toHaveAttribute("data-phase", "playing");
      expect(screen.getByTestId("count")).toHaveTextContent("3");
    });

    it("오른쪽 아래 타이머는 첫 탭 전까지 0.00초에 머문다", async () => {
      render(<ClickSpeed />);
      await startPlaying();
      expect(screen.getByTestId("play-timer")).toHaveTextContent("0.00초");
      await advance(500);
      expect(screen.getByTestId("play-timer")).toHaveTextContent("0.00초");
    });

    it("첫 탭부터 걸린 시간이 올라간다", async () => {
      render(<ClickSpeed />);
      await startPlaying();
      press();
      await advance(600);
      press();
      await advance(630);
      expect(screen.getByTestId("play-timer")).toHaveTextContent("1.23초");
    });

    it("카운트다운과 결과 화면에는 타이머가 없다", async () => {
      render(<ClickSpeed />);
      press();
      expect(screen.queryByTestId("play-timer")).toBeNull();

      await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
      press();
      await advance(IDLE_STOP_MS);
      expect(screen.queryByTestId("play-timer")).toBeNull();
    });
  });

  describe("결과", () => {
    it("탭을 멈추면 클릭 수, 초당 속도, 등급을 보여주고 광고가 나온다", async () => {
      render(<ClickSpeed />);
      await playRound(11, 100);

      expect(getScreenEl()).toHaveAttribute("data-phase", "result");
      expect(screen.getByTestId("result-count")).toHaveTextContent("11");
      expect(screen.getByTestId("result-cps")).toHaveTextContent("10.0");
      expect(screen.getByTestId("result-tier")).toHaveTextContent(/^프로게이머$/);
      expect(getScreenEl()).toHaveClass("bg-violet-600");
      expect(getAdSlot()).not.toBeNull();
    });

    it("느린 연타는 그에 맞는 등급 색을 보여준다", async () => {
      render(<ClickSpeed />);
      await playRound(5, 250);
      expect(screen.getByTestId("result-cps")).toHaveTextContent("4.0");
      expect(screen.getByTestId("result-tier")).toHaveTextContent(/^조금 느림$/);
      expect(getScreenEl()).toHaveClass("bg-warning");
    });

    it("한 번도 탭하지 않으면 기록을 남기지 않는다", async () => {
      render(<ClickSpeed />);
      await startPlaying();
      await advance(IDLE_STOP_MS);

      expect(screen.getByTestId("result-count")).toHaveTextContent("0");
      expect(screen.getByTestId("result-rank")).toHaveTextContent("탭한 기록이 없어요");
      expect(getLeaderboardRows()[0]).toHaveTextContent("-");
    });

    it("결과 화면에서 다시 탭하면 카운트다운이 시작된다", async () => {
      render(<ClickSpeed />);
      await playRound(3, 200);
      press();
      expect(screen.getByTestId("countdown")).toHaveTextContent("3");
    });
  });

  describe("순위표", () => {
    it("클릭 수가 많은 순서로 1위, 2위에 올리고 순위를 알려준다", async () => {
      render(<ClickSpeed />);

      await playRound(5, 250);
      expect(screen.getByTestId("result-rank")).toHaveTextContent("1위");

      await playRound(11, 100);
      expect(screen.getByTestId("result-rank")).toHaveTextContent("1위");

      const rows = getLeaderboardRows();
      expect(rows[0]).toHaveTextContent("11회");
      expect(rows[1]).toHaveTextContent("5회");
    });

    it("적은 기록은 그 순위를 알려준다", async () => {
      render(<ClickSpeed />);
      await playRound(11, 100);
      await playRound(5, 250);
      expect(screen.getByTestId("result-rank")).toHaveTextContent("2위");
    });

    it("새로고침해도 순위표가 남아 있다", async () => {
      const { unmount } = render(<ClickSpeed />);
      await playRound(7, 150);
      unmount();

      render(<ClickSpeed />);
      expect(getLeaderboardRows()[0]).toHaveTextContent("7회");
    });
  });

  describe("공유", () => {
    function queryShareButton() {
      return screen.queryByRole("button", { name: "공유하기" });
    }

    it("시작 화면과 결과 화면에 공유 버튼이 있다", async () => {
      render(<ClickSpeed />);
      expect(queryShareButton()).not.toBeNull();

      await playRound(3, 200);
      expect(queryShareButton()).not.toBeNull();
    });

    it("카운트다운과 플레이 중에는 공유 버튼이 없다", async () => {
      render(<ClickSpeed />);
      press();
      expect(queryShareButton()).toBeNull();

      await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
      expect(queryShareButton()).toBeNull();
    });

    it("결과 화면에서 공유 버튼을 눌러도 다시 시작되지 않는다", async () => {
      render(<ClickSpeed />);
      await playRound(3, 200);

      const share = screen.getByRole("button", { name: "공유하기" });
      fireEvent.pointerDown(share);
      fireEvent.click(share);

      expect(getScreenEl()).toHaveAttribute("data-phase", "result");
    });
  });

  describe("결과 요약과 공유 문구", () => {
    it("몇 위인지만 보여준다", async () => {
      render(<ClickSpeed />);
      await playRound(5, 250);
      expect(screen.getByTestId("result-rank").textContent).toBe("1위");
    });

    it("표에 보이는 5위 밖이어도 순위를 숫자로만 보여준다", async () => {
      render(<ClickSpeed />);
      for (const times of [8, 7, 6, 5, 4, 3]) {
        await playRound(times, 100);
      }
      expect(screen.getByTestId("result-rank").textContent).toBe("6위");
      expect(screen.queryByText(/순위권/)).toBeNull();
    });

    it("마지막에 등급, 속도, 설명을 한 줄로 보여준다", async () => {
      render(<ClickSpeed />);
      await playRound(11, 100);
      expect(screen.getByTestId("result-summary").textContent).toBe(
        "프로게이머 초당 10.0회, 손가락이 안 보일 정도예요",
      );
    });

    it("공유할지 묻는 문구를 공유 버튼과 함께 보여준다", async () => {
      render(<ClickSpeed />);
      await playRound(3, 200);
      const prompt = screen.getByText("이 기록을 친구에게 공유할까요?");
      expect(prompt.parentElement).toContainElement(screen.getByRole("button", { name: "공유하기" }));
    });

    it("공유 문구를 눌러도 다시 시작되지 않는다", async () => {
      render(<ClickSpeed />);
      await playRound(3, 200);
      const prompt = screen.getByText("이 기록을 친구에게 공유할까요?");
      fireEvent.pointerDown(prompt);
      fireEvent.click(prompt);
      expect(getScreenEl()).toHaveAttribute("data-phase", "result");
    });
  });

  describe("스크롤하면 나오는 순위 기록", () => {
    it("처음에는 순위 기록이 가려져 있고 배경은 등급 색이다", async () => {
      render(<ClickSpeed />);
      await playRound(11, 100);
      expect(screen.getByTestId("result-records")).toHaveAttribute("data-visible", "false");
      expect(getScreenEl()).toHaveClass("bg-violet-600");
    });

    it("스크롤해서 순위 기록이 보이면 배경이 바뀌고 목록이 나타난다", async () => {
      render(<ClickSpeed />);
      await playRound(11, 100);
      await setRecordsVisible(true);

      expect(screen.getByTestId("result-records")).toHaveAttribute("data-visible", "true");
      expect(getScreenEl()).toHaveClass("bg-background");
      expect(getScreenEl()).not.toHaveClass("bg-violet-600");
    });

    it("다시 위로 올리면 등급 색으로 돌아온다", async () => {
      render(<ClickSpeed />);
      await playRound(11, 100);
      await setRecordsVisible(true);
      await setRecordsVisible(false);

      expect(screen.getByTestId("result-records")).toHaveAttribute("data-visible", "false");
      expect(getScreenEl()).toHaveClass("bg-violet-600");
    });

    it("순위 기록 영역을 눌러도 다시 시작되지 않는다", async () => {
      render(<ClickSpeed />);
      await playRound(11, 100);
      await setRecordsVisible(true);

      const records = screen.getByTestId("result-records");
      fireEvent.pointerDown(records);
      fireEvent.click(records);
      expect(getScreenEl()).toHaveAttribute("data-phase", "result");
    });

    it("다음 판 결과는 순위 기록이 가려진 상태로 시작한다", async () => {
      render(<ClickSpeed />);
      await playRound(11, 100);
      await setRecordsVisible(true);
      await playRound(5, 250);

      expect(screen.getByTestId("result-records")).toHaveAttribute("data-visible", "false");
      expect(getScreenEl()).toHaveClass("bg-warning");
    });
  });
});
