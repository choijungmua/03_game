import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CapybaraDefense } from "./capybara-defense";
import { advanceGame, applyCommand, CLASSES, makeUnit, RULES } from "./engine";
import type { DefenseState } from "./engine";
import { testEnemy, testGame, testUnit } from "./defense-test-fixtures";
import { teamClient } from "./team-client";
import type { DefenseRoomView } from "./team-client";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  sessionStorage.clear();
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers(); });

const view = (state: DefenseState, version = 1): DefenseRoomView => ({ protocol: 1, code: "1234ABCD", version, tick: version, now: version, you: 0, host: 0, players: [{ slot: 0, ready: true, connected: true }, { slot: 1, ready: true, connected: true }], pausedReason: null, state });
async function restore(state: DefenseState) {
  sessionStorage.setItem("capybara-defense-survival-v1", JSON.stringify({ code: "1234ABCD", token: "12345678-1234-1234-1234-123456789abc" }));
  const read = vi.spyOn(teamClient, "read").mockResolvedValue(view(state));
  render(<CapybaraDefense seed={7} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  return read;
}
const poll = async () => act(async () => { await vi.advanceTimersByTimeAsync(250); });

describe("reward feedback on the real engine", () => {
  it("announces the actual summon and allows placement without another selection", () => {
    render(<CapybaraDefense seed={7} />);
    fireEvent.click(screen.getByRole("button", { name: "수비 시작" }));
    fireEvent.click(screen.getByRole("button", { name: /랜덤 소환/ }));
    const expected = applyCommand(testGame(), { type: "summon" }).state.units[0];
    expect(screen.getByRole("status")).toHaveTextContent(`#${expected.id}`);
    expect(screen.getByRole("status")).toHaveTextContent("전장 중앙에 등장");
    fireEvent.click(screen.getByRole("button", { name: "1번 배치 칸 · 비어 있음" }));
    expect(within(screen.getByLabelText("수비대 목록")).getByRole("button")).toHaveTextContent("배치");
    expect(screen.getByRole("status")).toHaveTextContent("이동");
  });
  it("shows group feedback instead of retaining the previous summon notice", () => {
    render(<CapybaraDefense seed={7} />);
    fireEvent.click(screen.getByRole("button", { name: "수비 시작" }));
    fireEvent.click(screen.getByRole("button", { name: /랜덤 소환/ }));
    fireEvent.keyDown(window, { key: "!", code: "Digit1", shiftKey: true });
    expect(screen.getByRole("status")).toHaveTextContent("1번 부대에 1마리");
    expect(screen.getByRole("status")).not.toHaveTextContent("획득");
  });
});

describe("accepted cooperative snapshots", () => {
  it("does not replay acquisitions when an existing room is restored", async () => {
    await restore(testGame({ units: [makeUnit(2, "mage", "epic")], tickets: [{ id: 3, rarity: "primordial" }], nextId: 4 }));
    expect(screen.getByRole("status")).not.toHaveTextContent("획득");
    expect(screen.getByRole("status")).not.toHaveAttribute("data-celebration");
  });
  it("announces a teammate summon without stealing the locally selected defender", async () => {
    const before = testGame({ units: [makeUnit(2, "warrior", "common")], nextId: 3 });
    const read = await restore(before);
    fireEvent.click(within(screen.getByLabelText("수비대 목록")).getByRole("button"));
    const next = applyCommand(before, { type: "summon" }).state;
    read.mockResolvedValue(view(next, 2));
    await poll();
    expect(screen.getByRole("status")).toHaveTextContent(`#${next.units[1].id}`);
    expect(screen.getByRole("status")).toHaveTextContent("선택해 이동");
    expect(within(screen.getByLabelText("수비대 목록")).getByRole("button", { pressed: true })).toHaveAttribute("data-unit-id", "2");
  });
  it("waits for an accepted response before showing a local purchase result", async () => {
    const before = testGame();
    await restore(before);
    let accept: ((next: DefenseRoomView) => void) | undefined;
    vi.spyOn(teamClient, "send").mockImplementation(() => new Promise(resolve => { accept = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: /랜덤 소환/ }));
    expect(screen.getByRole("status")).not.toHaveTextContent("획득");
    await act(async () => { await Promise.resolve(); });
    const next = applyCommand(before, { type: "summon" }).state;
    await act(async () => { accept?.(view(next, 2)); });
    expect(screen.getByRole("status")).toHaveTextContent(`#${next.units[0].id}`);
  });
  it("rebases rewards after a connection failure instead of replaying the gap", async () => {
    const before = testGame();
    const read = await restore(before);
    read.mockRejectedValue(new Error("offline"));
    await poll();
    const next = applyCommand(before, { type: "summon" }).state;
    read.mockResolvedValue(view(next, 2));
    await poll();
    expect(screen.getByRole("status")).not.toHaveTextContent("획득");
    read.mockResolvedValue(view(applyCommand(next, { type: "summon" }).state, 3));
    await poll();
    expect(screen.getByRole("status")).toHaveTextContent("획득");
  });
  it("keeps a rejected team command as an error without inventing a reward", async () => {
    await restore(testGame());
    vi.spyOn(teamClient, "send").mockRejectedValue(new Error("구매 거절"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /랜덤 소환/ })); });
    expect(screen.getByRole("status")).toHaveTextContent("구매 거절");
    expect(screen.getByRole("status")).not.toHaveAttribute("data-celebration");
    expect(within(screen.getByLabelText("수비대 목록")).queryAllByRole("button")).toHaveLength(0);
  });
  it("does not replay a dismissed result when an older snapshot arrives", async () => {
    const before = testGame();
    const read = await restore(before);
    const next = applyCommand(before, { type: "summon" }).state;
    read.mockResolvedValue(view(next, 2));
    await poll();
    fireEvent.click(within(screen.getByLabelText("수비대 목록")).getByRole("button"));
    read.mockResolvedValue(view(before, 1));
    await poll();
    expect(screen.getByRole("status")).not.toHaveTextContent("획득");
    expect(within(screen.getByLabelText("수비대 목록")).getByRole("button", { pressed: true })).toHaveAttribute("data-unit-id", String(next.units[0].id));
  });
  it("announces earned boss tickets with high-rarity emphasis", async () => {
    const before = testGame({ nextId: 200, units: [testUnit], enemies: [testEnemy({ hp: 1, round: 100, isBoss: true })] });
    const read = await restore(before);
    read.mockResolvedValue(view(advanceGame(before, RULES.tickMs), 2));
    await poll();
    expect(screen.getByRole("status")).toHaveTextContent("보스 처치");
    expect(screen.getByRole("status")).toHaveTextContent("태초 선택권");
    expect(screen.getByRole("status")).toHaveAttribute("data-celebration", "true");
  });
  it("exposes registerable collections before opening their panel", async () => {
    await restore(testGame({ units: CLASSES.map((item, index) => makeUnit(index + 1, item.id, "epic")), nextId: 4 }));
    expect(screen.getByRole("button", { name: /컬렉션 · 등록 [1-9]/ })).toBeVisible();
  });
  it("does not advertise another wave after round120 begins", async () => {
    await restore(testGame({ round: RULES.totalRounds }));
    expect(screen.queryByTestId("next-goal")).toBeNull();
  });
});
