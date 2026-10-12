import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createGame } from "./engine";
import { teamClient, type DefenseRoomView } from "./team-client";
import { useDefenseTeam } from "./use-defense-team";

const snapshot = (version = 1): DefenseRoomView => ({
  protocol: 1,
  code: "1234ABCD",
  version,
  tick: 0,
  now: 0,
  you: 0,
  host: 0,
  players: [{ slot: 0, ready: false, connected: true }],
  pausedReason: null,
  state: createGame(1),
});
const session = {
  code: "1234ABCD",
  token: "12345678-1234-1234-1234-123456789abc",
};
beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  sessionStorage.clear();
});
it("restores the seat and never overlaps polling while the previous request is pending", async () => {
  sessionStorage.setItem("capybara-defense-survival-v1", JSON.stringify(session));
  let finish: ((view: DefenseRoomView) => void) | undefined;
  const read = vi.spyOn(teamClient, "read").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const hook = renderHook(() => useDefenseTeam());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith(session);
  await act(async () => {
    finish?.(snapshot());
  });
  expect(hook.result.current.view?.code).toBe(session.code);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(read).toHaveBeenCalledTimes(2);
  hook.unmount();
});
it("serializes player commands and ignores a stale poll after a newer command response", async () => {
  vi.spyOn(teamClient, "create").mockResolvedValue({
    token: session.token,
    view: snapshot(),
  });
  let finishRead: ((view: DefenseRoomView) => void) | undefined;
  vi.spyOn(teamClient, "read").mockImplementation(
    () =>
      new Promise((resolve) => {
        finishRead = resolve;
      }),
  );
  const finishes: ((view: DefenseRoomView) => void)[] = [];
  const send = vi.spyOn(teamClient, "send").mockImplementation(
    () =>
      new Promise((resolve) => {
        finishes.push(resolve);
      }),
  );
  const hook = renderHook(() => useDefenseTeam());
  await act(async () => {
    await hook.result.current.create();
  });
  let first: Promise<void> | undefined;
  let second: Promise<void> | undefined;
  await act(async () => {
    first = hook.result.current.send({ type: "summon" });
    second = hook.result.current.send({ type: "summon" });
  });
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => {
    finishes[0](snapshot(2));
    await first;
  });
  expect(send).toHaveBeenCalledTimes(2);
  await act(async () => {
    finishes[1](snapshot(3));
    await second;
    finishRead?.(snapshot(1));
  });
  expect(hook.result.current.view?.version).toBe(3);
  hook.unmount();
});
it("shows a connection error while preserving the last authoritative snapshot", async () => {
  vi.spyOn(teamClient, "create").mockResolvedValue({
    token: session.token,
    view: snapshot(),
  });
  vi.spyOn(teamClient, "read").mockRejectedValue(new Error("offline"));
  const hook = renderHook(() => useDefenseTeam());
  await act(async () => {
    await hook.result.current.create();
  });
  expect(hook.result.current.status).toBe("error");
  expect(hook.result.current.error).toBe("offline");
  expect(hook.result.current.view?.version).toBe(1);
  hook.unmount();
});
it("does not resurrect a room when a pending creation finishes after leave", async () => {
  let finish:
    ((value: { token: string; view: DefenseRoomView }) => void) | undefined;
  vi.spyOn(teamClient, "create").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const hook = renderHook(() => useDefenseTeam());
  let creation: Promise<void> | undefined;
  await act(async () => {
    creation = hook.result.current.create();
  });
  await act(async () => {
    await hook.result.current.leave();
  });
  await act(async () => {
    finish?.({ token: session.token, view: snapshot() });
    await creation;
  });
  expect(hook.result.current.inRoom).toBe(false);
  expect(hook.result.current.view).toBeNull();
  expect(sessionStorage.length).toBe(0);
  hook.unmount();
});
it("ignores a previous room poll after joining a newer room", async () => {
  vi.spyOn(teamClient, "create").mockResolvedValue({
    token: session.token,
    view: snapshot(),
  });
  let finish: ((view: DefenseRoomView) => void) | undefined;
  vi.spyOn(teamClient, "read").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const next = { ...snapshot(), code: "AAAABBBB" };
  vi.spyOn(teamClient, "join").mockResolvedValue({
    token: "next-token",
    view: next,
  });
  const hook = renderHook(() => useDefenseTeam());
  await act(async () => {
    await hook.result.current.create();
  });
  const oldFinish = finish;
  await act(async () => {
    await hook.result.current.join(next.code);
  });
  await act(async () => {
    oldFinish?.(snapshot(100));
  });
  expect(hook.result.current.view?.code).toBe(next.code);
  hook.unmount();
});
it("keeps in-memory team play and shows a persistent warning when storage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  vi.spyOn(teamClient, "create").mockResolvedValue({
    token: session.token,
    view: snapshot(),
  });
  vi.spyOn(teamClient, "read").mockResolvedValue(snapshot(2));
  const hook = renderHook(() => useDefenseTeam());
  await act(async () => {
    await hook.result.current.create();
  });
  expect(hook.result.current.inRoom).toBe(true);
  expect(hook.result.current.view?.version).toBe(2);
  expect(hook.result.current.error).toContain("새로고침");
  hook.unmount();
});
it("does not issue queued commands after the hook unmounts", async () => {
  vi.spyOn(teamClient, "create").mockResolvedValue({
    token: session.token,
    view: snapshot(),
  });
  vi.spyOn(teamClient, "read").mockResolvedValue(snapshot());
  let finish: ((view: DefenseRoomView) => void) | undefined;
  const send = vi.spyOn(teamClient, "send").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const hook = renderHook(() => useDefenseTeam());
  await act(async () => {
    await hook.result.current.create();
  });
  let queued: Promise<void> | undefined;
  await act(async () => {
    void hook.result.current.send({ type: "summon" });
    queued = hook.result.current.send({ type: "summon" });
  });
  hook.unmount();
  await act(async () => {
    finish?.(snapshot(2));
    await queued;
  });
  expect(send).toHaveBeenCalledTimes(1);
});
it("pauses the server game when the document becomes hidden", async () => {
  const playing = {
    ...snapshot(),
    state: { ...createGame(1), phase: "playing" as const },
  };
  vi.spyOn(teamClient, "create").mockResolvedValue({
    token: session.token,
    view: playing,
  });
  vi.spyOn(teamClient, "read").mockResolvedValue(playing);
  const send = vi
    .spyOn(teamClient, "send")
    .mockResolvedValue({
      ...playing,
      state: { ...playing.state, phase: "paused" },
    });
  const hook = renderHook(() => useDefenseTeam());
  await act(async () => {
    await hook.result.current.create();
  });
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(send).toHaveBeenCalledWith(session, { type: "pause" });
  hook.unmount();
});
