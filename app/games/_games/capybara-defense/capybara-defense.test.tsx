import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapybaraDefense } from "./capybara-defense";
import { RULES } from "./engine";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function start() {
  const view = render(<CapybaraDefense seed={7} />);
  fireEvent.click(screen.getByRole("button", { name: "수비 시작" }));
  return view;
}

describe("new defense controls with the real engine", () => {
  it("disables focused commands when the selected enemy dies", () => {
    vi.useFakeTimers();
    start();
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByRole("button", { name: /랜덤 소환/ }));
    fireEvent.click(screen.getByRole("button", { name: /명령 ·/ }));
    const target = screen.getByRole("combobox", { name: "공격 대상" });
    const option = within(target).getAllByRole("option")[1];
    fireEvent.change(target, { target: { value: option.getAttribute("value") } });
    expect(screen.getByRole("button", { name: "집중 공격" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "집중 공격" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "1번 배치 칸 · 비어 있음" }));
    act(() => vi.advanceTimersByTime(5000));
    fireEvent.click(screen.getByRole("button", { name: /명령 ·/ }));
    expect(within(screen.getByRole("combobox", { name: "공격 대상" })).queryByRole("option", { name: option.textContent ?? "" })).toBeNull();
    expect(screen.getByRole("button", { name: "집중 공격" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "공격 대상" })).toHaveValue("");
  });
  it("moves a selected group to arbitrary coordinates and recalls the group", () => {
    const { container } = start();
    fireEvent.click(screen.getByRole("button", { name: /랜덤 소환/ }));
    fireEvent.click(screen.getByRole("button", { name: /랜덤 소환/ }));
    fireEvent.click(screen.getByRole("button", { name: /명령 ·/ }));
    fireEvent.click(screen.getByRole("button", { name: "전체 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "1번 저장" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "X 좌표" }), { target: { value: "333" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Y 좌표" }), { target: { value: "222" } });
    fireEvent.click(screen.getByRole("button", { name: "선택 부대 이동" }));
    fireEvent.click(screen.getByRole("button", { name: "선택 해제" }));
    fireEvent.click(screen.getByRole("button", { name: "1번 선택" }));
    expect(screen.getByRole("status")).toHaveTextContent("1번 부대를 선택");
    expect(within(screen.getByLabelText("수비대 목록")).getAllByRole("button", { pressed: true })).toHaveLength(2);
    expect(within(screen.getByLabelText("수비대 목록")).getAllByRole("button").every(button => button.textContent?.includes("배치"))).toBe(true);
    expect(container.querySelectorAll("[data-cell][data-unit-id]")).toHaveLength(0);
  });

  it("discloses all ten rarity probabilities and opens statistics with C", () => {
    start();
    fireEvent.keyDown(window, { key: "c" });
    const table = screen.getByRole("table", { name: "등급별 소환 확률과 보유 수" });
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getByText("종말")).toBeVisible();
    expect(screen.getByRole("table", { name: /공격 상성/ })).toBeVisible();
  });

  it("saves a group with the shifted Digit1 key and recalls it with 1", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: /랜덤 소환/ }));
    const first = within(screen.getByLabelText("수비대 목록")).getByRole("button");
    fireEvent.keyDown(window, { key: "!", code: "Digit1", shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /랜덤 소환/ }));
    expect(first).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(window, { key: "1", code: "Digit1" });
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByLabelText("수비대 목록")).getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  it("applies supported speed from the visible controls", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "4배속" }));
    expect(screen.getByRole("button", { name: "4배속" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1배속" })).toHaveAttribute("aria-pressed", "false");
  });

  it("places a summoned unit through keyboard activation", async () => {
    start();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /랜덤 소환/ }));
    const cell = screen.getByRole("button", { name: "1번 배치 칸 · 비어 있음" });
    cell.focus();
    await user.keyboard("{Enter}");
    expect(cell).toHaveAttribute("data-unit-id");
    expect(screen.getByTestId("gold")).toHaveTextContent(String(RULES.startingGold - RULES.summonCost));
    expect(within(screen.getByLabelText("수비대 목록")).getByRole("button")).toHaveTextContent("배치");
  });

  it("moves the selected defender instead of duplicating it", () => {
    const { container } = start();
    fireEvent.click(screen.getByRole("button", { name: /랜덤 소환/ }));
    fireEvent.click(screen.getByRole("button", { name: "1번 배치 칸 · 비어 있음" }));
    fireEvent.click(screen.getByRole("button", { name: "2번 배치 칸 · 비어 있음" }));
    expect(container.querySelectorAll("[data-cell][data-unit-id]")).toHaveLength(1);
    expect(container.querySelector('[data-cell="1"]')).toHaveAttribute("data-unit-id");
    expect(container.querySelector('[data-cell="0"]')).not.toHaveAttribute("data-unit-id");
  });

  it("requires confirmation before selling, refunds the unit, and restores focus", async () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: /랜덤 소환/ }));
    fireEvent.click(screen.getByRole("button", { name: /^판매/ }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^판매/ })).toHaveFocus());
    expect(within(screen.getByLabelText("수비대 목록")).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /^판매/ }));
    fireEvent.click(screen.getByRole("button", { name: "판매 확정" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /랜덤 소환/ })).toHaveFocus());
    expect(within(screen.getByLabelText("수비대 목록")).queryByRole("button")).toBeNull();
    expect(Number(screen.getByTestId("gold").textContent)).toBeGreaterThan(RULES.startingGold - RULES.summonCost);
  });

  it("spends gold on a class upgrade and exposes the new level", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: /자원 · 선택권/ }));
    fireEvent.click(screen.getByRole("button", { name: /전사 \+0/ }));
    expect(screen.getByRole("button", { name: /전사 \+1/ })).toBeInTheDocument();
    expect(Number(screen.getByTestId("gold").textContent)).toBeLessThan(RULES.startingGold);
  });

  it("disables summons after the player spends all available gold", () => {
    start();
    const summon = screen.getByRole("button", { name: /랜덤 소환/ });
    for (let i = 0; i < RULES.startingGold / RULES.summonCost; i++) fireEvent.click(summon);
    fireEvent.click(summon);
    expect(summon).toBeDisabled();
    expect(screen.getByTestId("gold")).toHaveTextContent("0");
    expect(within(screen.getByLabelText("수비대 목록")).getAllByRole("button")).toHaveLength(RULES.startingGold / RULES.summonCost);
  });

  it("freezes the real round clock while paused and resumes explicitly", () => {
    vi.useFakeTimers();
    const { container } = start();
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    act(() => vi.advanceTimersByTime(RULES.roundDurationMs * 2));
    expect(container.querySelector("[data-phase]")).toHaveAttribute("data-phase", "paused");
    expect(screen.getByTestId("round")).toHaveTextContent("1 / 120");
    fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
    act(() => vi.advanceTimersByTime(RULES.roundDurationMs + 300));
    expect(container.querySelector("[data-phase]")).toHaveAttribute("data-phase", "playing");
    expect(screen.getByTestId("round")).toHaveTextContent("2 / 120");
  });

  it("pauses when hidden without resuming on visibility change", () => {
    const { container } = start();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    expect(container.querySelector("[data-phase]")).toHaveAttribute("data-phase", "paused");
    expect(screen.getByRole("dialog")).toHaveTextContent("이어하기");
  });

  it("restarts a lost run from round one with no defenders", () => {
    vi.useFakeTimers();
    const { container } = start();
    act(() => vi.advanceTimersByTime(61_000));
    expect(container.querySelector("[data-phase]")).toHaveAttribute("data-phase", "lost");
    fireEvent.click(screen.getByRole("button", { name: "다시 도전" }));
    expect(container.querySelector("[data-phase]")).toHaveAttribute("data-phase", "playing");
    expect(screen.getByTestId("round")).toHaveTextContent("1 / 120");
    expect(screen.getByTestId("gold")).toHaveTextContent(String(RULES.startingGold));
    expect(container.querySelectorAll("[data-cell][data-unit-id]")).toHaveLength(0);
  });

  it("closes an open statistics panel when a run ends and focuses retry", () => {
    vi.useFakeTimers();
    start();
    fireEvent.click(screen.getByRole("button", { name: "통계 · 확률" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(61_000));
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "다시 도전" })).toHaveFocus();
  });

  it("never mounts an ad and restores scrolling on unmount", () => {
    const original = document.body.style.overflow;
    const { container, unmount } = start();
    expect(container.querySelector("[data-ad-placement], iframe, ins.adsbygoogle")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    expect(container.querySelector("[data-ad-placement], iframe, ins.adsbygoogle")).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe(original);
  });
});
