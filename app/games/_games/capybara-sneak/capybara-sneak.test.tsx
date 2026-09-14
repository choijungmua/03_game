import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapybaraSneak } from "./capybara-sneak";
import {
  AWAY_MS_RANGE,
  DECAY_GRACE_MS,
  DECAY_INTERVAL_MS,
  EAT_DELAY_MS,
  EAT_INTERVAL_MS,
  GLANCE_MS_RANGE,
  WARNING_MS_RANGE,
} from "./logic";

// Math.random을 0으로 고정하면 주인은 누른 순간부터
// 가장 짧은 등 돌림 → 가장 짧은 경고 → 흘끗 보기 → 다시 등 돌림 순서로 움직인다
const TURNING_AT = AWAY_MS_RANGE.min - WARNING_MS_RANGE.min;
const LOOKING_AT = AWAY_MS_RANGE.min;
const BACK_AWAY_AT = LOOKING_AT + GLANCE_MS_RANGE.min;

function gameScreen() {
  return screen.getByTestId("capybara-sneak-screen");
}

function press() {
  fireEvent.pointerDown(gameScreen());
}

function release() {
  fireEvent.pointerUp(window);
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function hold(ms: number) {
  press();
  await advance(ms);
  release();
}

// 결과 팝업이 열리면 뒤 화면이 접근성 트리에서 숨겨지므로 숨김 요소까지 찾는다
function gaugeValue() {
  return Number(
    screen
      .getByRole("progressbar", { name: "먹기 게이지", hidden: true })
      .getAttribute("aria-valuenow"),
  );
}

function ownerState() {
  return screen.getByTestId("owner").getAttribute("data-state");
}

function capybaraPose() {
  return screen.getByTestId("capybara").getAttribute("data-pose");
}

function getAdSlot() {
  return document.querySelector("[data-ad-placement]");
}

/** 주인이 등을 돌렸을 때만 꾹 누르고, 돌아보려 하면 손을 떼면서 목표 게이지까지 먹는다 */
async function eatUntil(target: number) {
  let holding = false;
  for (let step = 0; step < 5000 && gaugeValue() < target; step += 1) {
    if (ownerState() === "away" && !holding) {
      press();
      holding = true;
    } else if (ownerState() !== "away" && holding) {
      release();
      holding = false;
    }
    await advance(EAT_INTERVAL_MS);
  }
  if (holding) release();
}

describe("CapybaraSneak", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("게임 화면", () => {
    it("주인, 카피바라, 수박, 먹기 게이지와 꾹 누르라는 안내가 보인다", () => {
      render(<CapybaraSneak />);

      expect(ownerState()).toBe("away");
      expect(capybaraPose()).toBe("idle");
      expect(screen.getByTestId("food")).toHaveAttribute("data-stage", "full");
      expect(gaugeValue()).toBe(0);
      expect(screen.getByText(/꾹 눌러/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "먹기" })).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(getAdSlot()).toBeNull();
    });

    it("처음 누르기 전에는 주인이 돌아보지 않는다", async () => {
      render(<CapybaraSneak />);
      await advance(10_000);
      expect(ownerState()).toBe("away");
    });
  });

  describe("꾹 눌러 먹기", () => {
    it("누르자마자 먹는 자세를 잡지만 게이지는 잠깐 뒤에 1% 오른다", async () => {
      render(<CapybaraSneak />);
      press();
      expect(capybaraPose()).toBe("eating");
      expect(gaugeValue()).toBe(0);

      await advance(EAT_DELAY_MS - 1);
      expect(gaugeValue()).toBe(0);

      await advance(1);
      expect(gaugeValue()).toBe(1);
    });

    it("꾹 누르고 있으면 일정 간격으로 1%씩 계속 오른다", async () => {
      render(<CapybaraSneak />);
      press();
      await advance(EAT_DELAY_MS + EAT_INTERVAL_MS * 3);
      expect(gaugeValue()).toBe(4);
    });

    it("손을 떼면 먹기를 멈추고 카피바라가 원래 자세로 돌아온다", async () => {
      render(<CapybaraSneak />);
      await hold(EAT_DELAY_MS + EAT_INTERVAL_MS * 2);
      expect(gaugeValue()).toBe(3);

      await advance(DECAY_GRACE_MS - 1);
      expect(gaugeValue()).toBe(3);
      expect(capybaraPose()).toBe("idle");
    });

    it("딜레이보다 짧게 톡 치면 먹지 않는다", async () => {
      render(<CapybaraSneak />);
      await hold(EAT_DELAY_MS - 50);
      await advance(DECAY_GRACE_MS);
      expect(gaugeValue()).toBe(0);
    });

    it("화면 어느 곳을 눌러도 먹는다", async () => {
      render(<CapybaraSneak />);
      fireEvent.pointerDown(screen.getByTestId("food"));
      await advance(EAT_DELAY_MS);
      release();
      expect(gaugeValue()).toBe(1);
    });

    it("스페이스바를 꾹 눌러도 먹고, 키 반복 입력은 새로 누른 것으로 치지 않는다", async () => {
      render(<CapybaraSneak />);
      fireEvent.keyDown(window, { key: " " });
      await advance(EAT_DELAY_MS);
      expect(gaugeValue()).toBe(1);

      fireEvent.keyDown(window, { key: " ", repeat: true });
      await advance(EAT_INTERVAL_MS);
      expect(gaugeValue()).toBe(2);

      fireEvent.keyUp(window, { key: " " });
      await advance(EAT_INTERVAL_MS);
      expect(gaugeValue()).toBe(2);
    });

    it("엔터를 꾹 눌러도 먹는다", async () => {
      render(<CapybaraSneak />);
      fireEvent.keyDown(window, { key: "Enter" });
      await advance(EAT_DELAY_MS);
      fireEvent.keyUp(window, { key: "Enter" });
      expect(gaugeValue()).toBe(1);
    });

    it("게이지가 절반이 되면 수박이 반쯤 먹은 모습이 된다", async () => {
      render(<CapybaraSneak />);
      await eatUntil(50);
      expect(gaugeValue()).toBe(50);
      expect(screen.getByTestId("food")).toHaveAttribute("data-stage", "half");
    });
  });

  describe("안 먹으면 줄어드는 게이지", () => {
    it("손을 떼고 잠깐은 그대로였다가 일정 간격으로 1%씩 줄어든다", async () => {
      render(<CapybaraSneak />);
      await hold(EAT_DELAY_MS + EAT_INTERVAL_MS * 3);
      expect(gaugeValue()).toBe(4);

      await advance(DECAY_GRACE_MS - 1);
      expect(gaugeValue()).toBe(4);

      await advance(1);
      expect(gaugeValue()).toBe(3);

      await advance(DECAY_INTERVAL_MS);
      expect(gaugeValue()).toBe(2);
    });

    it("0% 아래로는 내려가지 않는다", async () => {
      render(<CapybaraSneak />);
      await hold(EAT_DELAY_MS);
      await advance(5_000);
      expect(gaugeValue()).toBe(0);
    });

    it("줄어드는 동안에는 게이지에 표시하고, 다시 먹으면 표시가 사라진다", async () => {
      render(<CapybaraSneak />);
      await hold(EAT_DELAY_MS + EAT_INTERVAL_MS * 3);
      expect(screen.getByTestId("gauge-panel")).toHaveAttribute("data-trend", "up");

      await advance(DECAY_GRACE_MS);
      expect(screen.getByTestId("gauge-panel")).toHaveAttribute("data-trend", "down");
      expect(screen.getByText("줄어드는 중")).toBeInTheDocument();

      await advance(BACK_AWAY_AT - (EAT_DELAY_MS + EAT_INTERVAL_MS * 3) - DECAY_GRACE_MS);
      expect(ownerState()).toBe("away");
      await hold(EAT_DELAY_MS);
      expect(screen.getByTestId("gauge-panel")).toHaveAttribute("data-trend", "up");
      expect(screen.queryByText("줄어드는 중")).toBeNull();
    });
  });

  describe("주인", () => {
    it("돌아보기 직전에 경고를 보여준다", async () => {
      render(<CapybaraSneak />);
      await hold(EAT_DELAY_MS);
      await advance(TURNING_AT - EAT_DELAY_MS);

      expect(ownerState()).toBe("turning");
      expect(screen.getByTestId("owner-warning")).toBeInTheDocument();
    });

    it("경고 중에 계속 먹어도 실패하지 않는다", async () => {
      render(<CapybaraSneak />);
      press();
      await advance(LOOKING_AT - 1);

      expect(ownerState()).toBe("turning");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(gaugeValue()).toBeGreaterThan(1);
    });

    it("흘끗 보고는 금방 다시 등을 돌린다", async () => {
      render(<CapybaraSneak />);
      await hold(EAT_DELAY_MS);
      await advance(LOOKING_AT - EAT_DELAY_MS);
      expect(ownerState()).toBe("looking");

      await advance(GLANCE_MS_RANGE.min - 1);
      expect(ownerState()).toBe("looking");

      await advance(1);
      expect(ownerState()).toBe("away");
    });

    it("주인이 돌아봤는데 손을 안 떼고 계속 먹으면 실패 팝업이 뜬다", async () => {
      render(<CapybaraSneak />);
      press();
      await advance(LOOKING_AT + EAT_INTERVAL_MS);

      expect(ownerState()).toBe("looking");
      expect(screen.getByRole("dialog", { name: "들켰다!" })).toBeInTheDocument();
      expect(capybaraPose()).toBe("caught");
    });

    it("주인이 보고 있을 때 눌러서 게이지가 오르는 순간 실패한다", async () => {
      render(<CapybaraSneak />);
      await hold(EAT_DELAY_MS);
      await advance(LOOKING_AT - EAT_DELAY_MS);
      expect(ownerState()).toBe("looking");

      press();
      expect(screen.queryByRole("dialog")).toBeNull();
      await advance(EAT_DELAY_MS);

      expect(screen.getByRole("dialog", { name: "들켰다!" })).toBeInTheDocument();
    });

    it("흘끗 보는 동안 참으면 다시 먹을 수 있다", async () => {
      render(<CapybaraSneak />);
      await hold(EAT_DELAY_MS);
      await advance(BACK_AWAY_AT - EAT_DELAY_MS);
      expect(ownerState()).toBe("away");

      const before = gaugeValue();
      await hold(EAT_DELAY_MS);
      expect(gaugeValue()).toBe(before + 1);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("결과 팝업", () => {
    it("게이지를 100% 채우면 성공 팝업이 뜨고 접시가 빈다", async () => {
      render(<CapybaraSneak />);
      await eatUntil(100);

      expect(gaugeValue()).toBe(100);
      expect(screen.getByRole("dialog", { name: "다 먹었다!" })).toBeInTheDocument();
      expect(screen.getByTestId("food")).toHaveAttribute("data-stage", "empty");
    });

    it("게임이 끝나면 주인도 게이지도 멈춘다", async () => {
      render(<CapybaraSneak />);
      press();
      await advance(LOOKING_AT + EAT_INTERVAL_MS);
      release();
      const gaugeAtFail = gaugeValue();

      await advance(10_000);
      expect(ownerState()).toBe("looking");
      expect(gaugeValue()).toBe(gaugeAtFail);
    });

    it("광고는 결과 팝업에서만 보인다", async () => {
      render(<CapybaraSneak />);
      await eatUntil(99);
      expect(getAdSlot()).toBeNull();

      await eatUntil(100);
      expect(screen.getByRole("dialog")).toContainElement(getAdSlot() as HTMLElement);
    });

    it("다시 하기를 누르면 처음 상태로 돌아간다", async () => {
      render(<CapybaraSneak />);
      press();
      await advance(LOOKING_AT + EAT_INTERVAL_MS);
      release();

      fireEvent.click(screen.getByRole("button", { name: "다시 하기" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(gaugeValue()).toBe(0);
      expect(ownerState()).toBe("away");
      expect(capybaraPose()).toBe("idle");
      expect(screen.getByTestId("food")).toHaveAttribute("data-stage", "full");
      expect(screen.getByTestId("gauge-panel")).toHaveAttribute("data-trend", "up");

      await advance(10_000);
      expect(ownerState()).toBe("away");
    });

    it("팝업 안을 눌러도 먹지 않고, 다시 하기만 동작한다", async () => {
      render(<CapybaraSneak />);
      await eatUntil(100);

      const retry = screen.getByRole("button", { name: "다시 하기" });
      fireEvent.pointerDown(retry);
      fireEvent.click(retry);
      await advance(1000);

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(gaugeValue()).toBe(0);
    });
  });

  describe("일시정지", () => {
    function pauseButton() {
      return screen.getByRole("button", { name: "일시정지" });
    }

    it("시작 전에는 일시정지 버튼 없이 로비 링크만 있다", () => {
      render(<CapybaraSneak />);
      expect(screen.queryByRole("button", { name: "일시정지" })).toBeNull();
      expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
    });

    it("멈춘 동안에는 게이지도 주인도 움직이지 않고, 이어하면 남은 시간부터 다시 움직인다", async () => {
      render(<CapybaraSneak />);
      press();
      await advance(EAT_DELAY_MS);
      const eaten = gaugeValue();
      expect(eaten).toBeGreaterThan(0);

      fireEvent.click(pauseButton());
      const ownerAtPause = ownerState();
      expect(ownerAtPause).toBe("away");

      // 멈추지 않았다면 LOOKING_AT 안에 turning → looking까지 진행했을 시간이지만, 멈춘 동안은 그대로다
      await advance(LOOKING_AT);
      expect(gaugeValue()).toBe(eaten);
      expect(ownerState()).toBe(ownerAtPause);
      expect(screen.queryByText("들켰다!")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
      release();
      // 멈추기 전 이미 EAT_DELAY_MS만큼 지나 있었으므로, 새 TURNING_AT이 아니라 남은 시간만 지나면 된다
      await advance(TURNING_AT - EAT_DELAY_MS);
      expect(ownerState()).toBe("turning");
    });

    it("주인이 보고 있을 때 멈췄다 이어하면 보던 채로, 남은 시간이 지나야 등을 돌린다", async () => {
      render(<CapybaraSneak />);
      press();
      release();
      await advance(LOOKING_AT);
      expect(ownerState()).toBe("looking");

      const intoLook = 100;
      expect(intoLook).toBeLessThan(GLANCE_MS_RANGE.min);
      await advance(intoLook);

      fireEvent.click(pauseButton());
      await advance(10_000);
      // 시선을 피해 등을 돌리게 만들 수 없다 — 멈춰 있는 동안은 계속 보고 있다
      expect(ownerState()).toBe("looking");
      expect(gaugeValue()).toBe(0);

      fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
      expect(ownerState()).toBe("looking");

      const remaining = GLANCE_MS_RANGE.min - intoLook;
      await advance(remaining - 1);
      expect(ownerState()).toBe("looking");
      await advance(1);
      expect(ownerState()).toBe("away");
    });

    it("경고(turning) 중에 멈췄다 이어하기를 반복해도, 원래 경고 시간이 지나야 본다", async () => {
      render(<CapybaraSneak />);
      press();
      release();
      await advance(TURNING_AT);
      expect(ownerState()).toBe("turning");

      // Esc 스팸을 흉내: 조금씩만 진행시키고 그 사이사이 오래 멈췄다 이어한다
      const step = 50;
      expect(step).toBeLessThan(WARNING_MS_RANGE.min);
      let elapsed = 0;
      while (elapsed + step < WARNING_MS_RANGE.min) {
        fireEvent.click(pauseButton());
        await advance(5_000);
        expect(ownerState()).toBe("turning");

        fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
        await advance(step);
        elapsed += step;
        expect(ownerState()).toBe("turning");
      }

      // 안 멈췄을 때와 같은 총 경고 시간(WARNING_MS_RANGE.min)이 지나면 본다 — 멈춤이 경고를 늘리지 못한다
      await advance(WARNING_MS_RANGE.min - elapsed);
      expect(ownerState()).toBe("looking");
    });

    it("등을 돌리고 있을 때 멈췄다 이어하면, 원래 예정된 시간이 지나야 경고가 뜬다", async () => {
      render(<CapybaraSneak />);
      press();
      release();
      expect(ownerState()).toBe("away");

      const beforePause = 100;
      await advance(beforePause);

      fireEvent.click(pauseButton());
      await advance(5_000);
      expect(ownerState()).toBe("away");

      fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
      // 새 away 주기(TURNING_AT 전체)가 아니라, 멈추기 전 지난 시간을 뺀 나머지만 지나면 된다
      await advance(TURNING_AT - beforePause - 1);
      expect(ownerState()).toBe("away");

      await advance(1);
      expect(ownerState()).toBe("turning");
    });

    it("멈춘 동안 스페이스바를 눌러도 먹지 않는다", async () => {
      render(<CapybaraSneak />);
      press();
      await advance(EAT_DELAY_MS);
      const eaten = gaugeValue();

      fireEvent.click(pauseButton());
      fireEvent.keyDown(window, { key: " " });
      expect(capybaraPose()).toBe("idle");
      await advance(EAT_DELAY_MS + EAT_INTERVAL_MS * 3);
      expect(gaugeValue()).toBe(eaten);
    });

    it("멈춘 상태에서 처음부터를 누르면 창이 닫히고 시작 전으로 돌아간다", async () => {
      render(<CapybaraSneak />);
      press();
      await advance(EAT_DELAY_MS);
      fireEvent.click(pauseButton());

      fireEvent.click(screen.getByRole("button", { name: "처음부터" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(gaugeValue()).toBe(0);
      expect(screen.queryByRole("button", { name: "일시정지" })).toBeNull();
    });
  });
});
