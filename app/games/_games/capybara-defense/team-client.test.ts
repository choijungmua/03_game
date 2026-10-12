import { afterEach, describe, expect, it, vi } from "vitest";
import { createGame, applyCommand } from "./engine";
import { newerView, teamClient, TeamError, type DefenseRoomView } from "./team-client";

const snapshot = (version: number): DefenseRoomView => ({
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
afterEach(() => vi.unstubAllGlobals());
describe("team transport", () => {
  it("keeps the newer snapshot when an older response arrives", () => {
    const latest = snapshot(20);
    expect(newerView(latest, snapshot(19))).toBe(latest);
    expect(newerView(latest, snapshot(21)).version).toBe(21);
    expect(
      newerView({ ...latest, now: 200 }, { ...latest, now: 100 }).now,
    ).toBe(200);
  });
  it("sends seat credentials in the authorization header and never in URLs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(snapshot(1))));
    vi.stubGlobal("fetch", fetcher);
    await teamClient.read({ code: "1234ABCD", token: "private-seat-token" });
    expect(fetcher.mock.calls[0][0]).not.toContain("private-seat-token");
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer private-seat-token",
    );
  });
  it("surfaces HTTP failures instead of replacing authoritative state", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: "방 인증이 필요해요." }), {
            status: 401,
          }),
        ),
    );
    await expect(
      teamClient.read({ code: "1234ABCD", token: "invalid" }),
    ).rejects.toThrow("방 인증");
  });
  it.each([
    null,
    { ...snapshot(1), protocol: 2 },
    { ...snapshot(1), state: { ...snapshot(1).state, units: [{ id: 1, classId: "unknown" }] } },
    { ...snapshot(1), state: { ...snapshot(1).state, gold: null } },
    { ...snapshot(1), players: [null] },
  ])("rejects malformed successful snapshots with a recoverable error (%j)", async value => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(value))));
    await expect(teamClient.read({ code: "1234ABCD", token: "seat" })).rejects.toThrow(TeamError);
  });
  it.each(["<html>proxy error</html>", "{"])("explains malformed JSON in Korean (%s)", async value => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(value)));
    await expect(teamClient.read({ code: "1234ABCD", token: "seat" })).rejects.toThrow("다시 시도");
  });
  it("handles null HTTP errors without accessing properties on null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("null", { status: 503 })));
    await expect(teamClient.read({ code: "1234ABCD", token: "seat" })).rejects.toThrow(TeamError);
  });
  it("validates a created room envelope and accepts valid unit state", async () => {
    const started = applyCommand(createGame(1), { type: "start" }).state;
    const view = { ...snapshot(1), state: applyCommand(started, { type: "summon" }).state };
    const result = { token: "12345678-1234-1234-1234-123456789abc", view };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(result))).mockResolvedValueOnce(new Response(JSON.stringify({ token: null, view }))));
    await expect(teamClient.create()).resolves.toEqual(result);
    await expect(teamClient.create()).rejects.toThrow(TeamError);
  });
  it("uses the shared network recovery message when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(teamClient.read({ code: "1234ABCD", token: "seat" })).rejects.toThrow("게임 서버에 연결할 수 없어요");
  });
});
