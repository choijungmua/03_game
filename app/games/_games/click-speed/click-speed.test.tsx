import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GAME_TITLES } from "@/lib/games/constants";
import { mockIntersectionObserver } from "@/lib/games/testing/mock-intersection-observer";

import { ClickSpeed, COUNTDOWN_STEP_MS, COUNTDOWN_VALUES } from "./click-speed";
import { RESULT_TAP_GUARD_MS } from "./constants";
import { DEFAULT_SECONDS } from "./records";

function getScreenEl() {
  return screen.getByTestId("click-speed-screen");
}

// 실제 탭처럼 pointerdown -> click 순서로 발생시킨다
function press(target: HTMLElement = getScreenEl()) {
  fireEvent.pointerDown(target, { clientX: 120, clientY: 80 });
  fireEvent.click(target, { clientX: 120, clientY: 80 });
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function startPlaying() {
  // 결과 화면 직후에는 탭을 잠깐 무시하므로(연타 여운 방지) 이어서 다음 판을 시작할 때는 그만큼 기다린다
  if (getScreenEl().getAttribute("data-phase") === "result") await advance(RESULT_TAP_GUARD_MS);
  press();
  await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
}

async function tapTimes(times: number, intervalMs: number) {
  for (let i = 0; i < times; i += 1) {
    if (i > 0) await advance(intervalMs);
    press();
  }
}

/** 탭을 다 치고 정한 시간이 끝날 때까지 기다린다 */
async function playRound(times: number, intervalMs: number, seconds = DEFAULT_SECONDS) {
  await startPlaying();
  await tapTimes(times, intervalMs);
  await advance(seconds * 1000 - Math.max(0, times - 1) * intervalMs);
}

function getLeaderboardRows() {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1);
}

function getAdSlot() {
  return document.querySelector("[data-ad-placement]");
}

function getDurationButton(seconds: number) {
  return screen.getByRole("button", { name: `${seconds}초` });
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

  describe("플레이 중 스크롤", () => {
    it("카운트다운·연타 중에는 페이지 스크롤과 브라우저 터치 제스처를 막고, 결과 화면에서 풀린다 — 연타하다 화면이 밀리지 않게", async () => {
      render(<ClickSpeed />);
      expect(getScreenEl()).toHaveClass("touch-manipulation");

      press();
      expect(document.documentElement.style.overflow).toBe("hidden");
      expect(getScreenEl()).toHaveClass("touch-none");

      await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
      expect(getScreenEl()).toHaveAttribute("data-phase", "playing");
      expect(document.documentElement.style.overflow).toBe("hidden");

      await advance(DEFAULT_SECONDS * 1000);
      expect(getScreenEl()).toHaveAttribute("data-phase", "result");
      expect(document.documentElement.style.overflow).toBe("");
      expect(getScreenEl()).toHaveClass("touch-manipulation");
    });
  });

  describe("시작 화면", () => {
    it("제목과 가운데 시작 안내를 보여준다", () => {
      render(<ClickSpeed />);
      expect(getScreenEl()).toHaveAttribute("data-phase", "idle");
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(GAME_TITLES["click-speed"]);
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

  describe("뒤로 버튼", () => {
    it("시작 화면에서는 로비로 가는 링크다", () => {
      render(<ClickSpeed />);
      expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
    });

    it("연타 중 누르면 기록을 남기지 않고 시작 화면으로 돌아간다", async () => {
      render(<ClickSpeed />);
      await startPlaying();
      await tapTimes(3, 100);

      const cancel = screen.getByRole("button", { name: "이번 판 그만하기" });
      fireEvent.pointerDown(cancel);
      fireEvent.click(cancel);
      expect(getScreenEl()).toHaveAttribute("data-phase", "idle");

      await advance(DEFAULT_SECONDS * 1000);
      expect(getScreenEl()).toHaveAttribute("data-phase", "idle");
      expect(window.localStorage.getItem("click-speed-records")).toBeNull();
    });
  });

  describe("연타 시간 선택", () => {
    it("기본은 5초가 선택돼 있다", () => {
      render(<ClickSpeed />);
      expect(DEFAULT_SECONDS).toBe(5);
      expect(getDurationButton(5)).toHaveAttribute("aria-pressed", "true");
      expect(getDurationButton(10)).toHaveAttribute("aria-pressed", "false");
    });

    it("시간 버튼을 눌러도 게임이 시작되지 않는다", () => {
      render(<ClickSpeed />);
      press(getDurationButton(10));
      expect(getDurationButton(10)).toHaveAttribute("aria-pressed", "true");
      expect(getScreenEl()).toHaveAttribute("data-phase", "idle");
    });

    it("고른 시간 동안 플레이하고 그 시간으로 속도를 구한다", async () => {
      render(<ClickSpeed />);
      press(getDurationButton(10));
      await startPlaying();
      expect(screen.getByTestId("play-timer")).toHaveTextContent("10.00초");

      await tapTimes(20, 100);
      await advance(10_000 - 19 * 100 - 1);
      expect(getScreenEl()).toHaveAttribute("data-phase", "playing");

      await advance(1);
      expect(getScreenEl()).toHaveAttribute("data-phase", "result");
      expect(screen.getByTestId("result-seconds")).toHaveTextContent("10초 동안");
      expect(screen.getByTestId("result-cps")).toHaveTextContent("2.0");
    });

    it("순위표는 고른 시간의 기록만 보여준다", async () => {
      render(<ClickSpeed />);
      await playRound(20, 100);
      expect(getLeaderboardRows()[0]).toHaveTextContent("20회");

      press(getDurationButton(3));
      expect(getScreenEl()).toHaveAttribute("data-phase", "result");
      expect(getLeaderboardRows()[0]).toHaveTextContent("-");
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

    it("탭을 멈춰도 정한 시간이 끝날 때까지 플레이가 이어진다", async () => {
      render(<ClickSpeed />);
      await startPlaying();
      press();
      await advance(DEFAULT_SECONDS * 1000 - 1);
      expect(getScreenEl()).toHaveAttribute("data-phase", "playing");
      await advance(1);
      expect(getScreenEl()).toHaveAttribute("data-phase", "result");
    });

    it("오른쪽 아래 타이머는 남은 시간을 줄여 간다", async () => {
      render(<ClickSpeed />);
      await startPlaying();
      expect(screen.getByTestId("play-timer")).toHaveTextContent("5.00초");
      // 가짜 타이머의 requestAnimationFrame은 16ms마다 돈다
      await advance(1232);
      expect(screen.getByTestId("play-timer")).toHaveTextContent("3.77초");
    });

    it("카운트다운과 결과 화면에는 타이머가 없다", async () => {
      render(<ClickSpeed />);
      press();
      expect(screen.queryByTestId("play-timer")).toBeNull();

      await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
      press();
      await advance(DEFAULT_SECONDS * 1000);
      expect(screen.queryByTestId("play-timer")).toBeNull();
    });
  });

  describe("결과", () => {
    it("시간이 끝나면 클릭 수, 초당 속도, 등급을 보여주고 광고가 나온다", async () => {
      render(<ClickSpeed />);
      await playRound(50, 90);

      expect(getScreenEl()).toHaveAttribute("data-phase", "result");
      expect(screen.getByTestId("result-seconds")).toHaveTextContent("5초 동안");
      expect(screen.getByTestId("result-count")).toHaveTextContent("50");
      expect(screen.getByTestId("result-cps")).toHaveTextContent("10.0");
      expect(screen.getByTestId("result-tier")).toHaveTextContent(/^프로게이머$/);
      expect(getScreenEl()).toHaveClass("bg-violet-600");
      expect(getAdSlot()).not.toBeNull();
    });

    it("느린 연타는 그에 맞는 등급 색을 보여준다", async () => {
      render(<ClickSpeed />);
      await playRound(20, 100);
      expect(screen.getByTestId("result-cps")).toHaveTextContent("4.0");
      expect(screen.getByTestId("result-tier")).toHaveTextContent(/^조금 느림$/);
      expect(getScreenEl()).toHaveClass("bg-warning");
    });

    it("한 번도 탭하지 않으면 기록을 남기지 않는다", async () => {
      render(<ClickSpeed />);
      await startPlaying();
      await advance(DEFAULT_SECONDS * 1000);

      expect(screen.getByTestId("result-count")).toHaveTextContent("0");
      expect(screen.getByTestId("result-rank")).toHaveTextContent("탭한 기록이 없어요");
      expect(getLeaderboardRows()[0]).toHaveTextContent("-");
    });

    it("결과 화면에서 잠깐 뒤 다시 탭하면 카운트다운이 시작된다", async () => {
      render(<ClickSpeed />);
      await playRound(3, 200);
      await advance(RESULT_TAP_GUARD_MS);
      press();
      expect(screen.getByTestId("countdown")).toHaveTextContent("3");
    });

    it("시간이 끝나는 순간에도 연타하던 탭·키는 결과 화면을 넘기지 않는다", async () => {
      render(<ClickSpeed />);
      await playRound(30, 100);
      expect(screen.getByTestId("result-count")).toHaveTextContent("30");

      // 결과가 뜬 직후 이어진 연타와 Space
      press();
      await advance(100);
      press();
      fireEvent.keyDown(window, { key: " " });
      await advance(RESULT_TAP_GUARD_MS - 200);
      press();
      expect(getScreenEl()).toHaveAttribute("data-phase", "result");
      expect(screen.getByTestId("result-count")).toHaveTextContent("30");

      await advance(100);
      press();
      expect(getScreenEl()).toHaveAttribute("data-phase", "countdown");
    });
  });

  describe("순위표", () => {
    it("클릭 수가 많은 순서로 1위, 2위에 올리고 순위를 알려준다", async () => {
      render(<ClickSpeed />);

      await playRound(20, 100);
      expect(screen.getByTestId("result-rank")).toHaveTextContent("1위");

      await playRound(50, 90);
      expect(screen.getByTestId("result-rank")).toHaveTextContent("1위");

      const rows = getLeaderboardRows();
      expect(rows[0]).toHaveTextContent("50회");
      expect(rows[1]).toHaveTextContent("20회");
    });

    it("적은 기록은 그 순위를 알려준다", async () => {
      render(<ClickSpeed />);
      await playRound(50, 90);
      await playRound(20, 100);
      expect(screen.getByTestId("result-rank")).toHaveTextContent("2위");
    });

    it("새로고침해도 순위표가 남아 있다", async () => {
      const { unmount } = render(<ClickSpeed />);
      await playRound(35, 100);
      unmount();

      render(<ClickSpeed />);
      expect(getLeaderboardRows()[0]).toHaveTextContent("35회");
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
      await playRound(20, 100);
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
      await playRound(50, 90);
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
      await playRound(50, 90);
      expect(screen.getByTestId("result-records")).toHaveAttribute("data-visible", "false");
      expect(getScreenEl()).toHaveClass("bg-violet-600");
    });

    it("스크롤해서 순위 기록이 보이면 배경이 바뀌고 목록이 나타난다", async () => {
      render(<ClickSpeed />);
      await playRound(50, 90);
      await setRecordsVisible(true);

      expect(screen.getByTestId("result-records")).toHaveAttribute("data-visible", "true");
      expect(getScreenEl()).toHaveClass("bg-background");
      expect(getScreenEl()).not.toHaveClass("bg-violet-600");
    });

    it("다시 위로 올리면 등급 색으로 돌아온다", async () => {
      render(<ClickSpeed />);
      await playRound(50, 90);
      await setRecordsVisible(true);
      await setRecordsVisible(false);

      expect(screen.getByTestId("result-records")).toHaveAttribute("data-visible", "false");
      expect(getScreenEl()).toHaveClass("bg-violet-600");
    });

    it("순위 기록 영역을 눌러도 다시 시작되지 않는다", async () => {
      render(<ClickSpeed />);
      await playRound(50, 90);
      await setRecordsVisible(true);

      const records = screen.getByTestId("result-records");
      fireEvent.pointerDown(records);
      fireEvent.click(records);
      expect(getScreenEl()).toHaveAttribute("data-phase", "result");
    });

    it("다음 판 결과는 순위 기록이 가려진 상태로 시작한다", async () => {
      render(<ClickSpeed />);
      await playRound(50, 90);
      await setRecordsVisible(true);
      await playRound(20, 100);

      expect(screen.getByTestId("result-records")).toHaveAttribute("data-visible", "false");
      expect(getScreenEl()).toHaveClass("bg-warning");
    });
  });
});
