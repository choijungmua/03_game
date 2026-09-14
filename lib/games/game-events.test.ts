import { afterEach, describe, expect, it, vi } from "vitest";

import { recordGameShare, recordGameVisit, submitGameRecord } from "./game-events";

const API = "http://localhost:4000/api/games/reaction-time";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("게임 이벤트 → 백엔드", () => {
  it("입장·기록·공유를 같은 탭 세션 id로 백엔드에 보낸다", async () => {
    const fetchMock = vi.fn((_input: string, _init: RequestInit) => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetchMock);

    await recordGameVisit("reaction-time");
    const record = { id: "1", ms: 231, at: 1 };
    await submitGameRecord("reaction-time", record.ms, record);
    await recordGameShare("reaction-time", "clipboard");

    const sessionId = sessionStorage.getItem("game-session-id");
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(fetchMock).toHaveBeenNthCalledWith(1, `${API}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      keepalive: true,
    });
    expect(fetchMock.mock.calls[1][0]).toBe(`${API}/records`);
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ sessionId, score: 231, data: record }));
    expect(fetchMock.mock.calls[2][0]).toBe(`${API}/shares`);
    expect(fetchMock.mock.calls[2][1].body).toBe(JSON.stringify({ sessionId, method: "clipboard" }));
  });

  it("요청이 실패해도 삼킨다", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    await expect(submitGameRecord("reaction-time", 1, {})).resolves.toBeUndefined();
  });
});
