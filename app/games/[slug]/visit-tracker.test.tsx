import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { completeGameRound, quitGameRound, startGameRound } from "@/lib/games/game-events";
import { GameVisitTracker } from "./visit-tracker";

afterEach(async () => {
  await quitGameRound("reaction-time");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["unmount", "pagehide"])("%s 시 진행 중인 판만 한 번 중도 이탈로 기록한다", async (exit) => {
  const bodies: string[] = [];
  vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
    bodies.push(String(init.body));
    return Promise.resolve(new Response(null, { status: 202 }));
  }));
  const { unmount } = render(<GameVisitTracker slug="reaction-time" />);
  await act(async () => {});
  expect(bodies.some((body) => body.includes('"game_start"'))).toBe(false);
  await startGameRound("reaction-time");
  if (exit === "pagehide") window.dispatchEvent(new Event("pagehide"));
  unmount();
  await act(async () => {});
  expect(bodies.filter((body) => body.includes('"game_quit"'))).toHaveLength(1);
});

it("방문 후 플레이하지 않고 나가면 중도 이탈이나 재개로 기록하지 않는다", async () => {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() => Promise.resolve(new Response(null, { status: 202 })));
  vi.stubGlobal("fetch", fetchMock);
  const { unmount } = render(<GameVisitTracker slug="reaction-time" />);
  unmount();
  await act(async () => {});
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]?.[0]).toContain("/visits");
});

it("뒤로가기 캐시에서 돌아오면 같은 판을 재개하고 떠나 있던 시간은 제외한다", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const bodies: string[] = [];
  vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
    bodies.push(String(init.body));
    return Promise.resolve(new Response(null, { status: 202 }));
  }));
  const { unmount } = render(<GameVisitTracker slug="reaction-time" />);
  await startGameRound("reaction-time");
  now = 1000;
  window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
  now = 9000;
  window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  now = 10_000;
  await completeGameRound("reaction-time");
  unmount();
  await act(async () => {});
  expect(bodies.filter((body) => body.includes('"game_start"'))).toHaveLength(1);
  expect(bodies.filter((body) => body.includes('"game_resume"'))).toHaveLength(1);
  const completion = bodies.find((body) => body.includes('"game_complete"'));
  expect(completion).toContain('"durationSeconds":2');
  const roundIds = bodies.flatMap((body) => body.match(/"roundId":"([^"]+)"/)?.[1] ?? []);
  expect(new Set(roundIds).size).toBe(1);
});
