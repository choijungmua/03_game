import { afterEach, describe, expect, it, vi } from "vitest";

import { recordGameShare, recordGameTelemetry, recordGameVisit, submitGameRecord, wasGameCompleted } from "./game-events";

const API = "http://localhost:4000/api/games/reaction-time";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("게임 이벤트 → 백엔드", () => {
  it("입장·기록·공유를 같은 탭 세션 id로 백엔드에 보낸다", async () => {
    const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetchMock);

    await recordGameVisit("reaction-time");
    const record = { id: "1", ms: 231, at: 1 };
    await submitGameRecord("reaction-time", record.ms, record);
    await recordGameShare("reaction-time", "clipboard");

    const sessionId = sessionStorage.getItem("game-session-id");
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    // 서버가 꺼져 있어도 오래 매달리지 않게 제한 시간 signal도 같이 넘긴다
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API}/visits`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining(`\"sessionId\":\"${sessionId}\"`),
        keepalive: true,
      }),
    );
    expect(fetchMock.mock.calls[1][0]).toBe(`${API}/records`);
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ sessionId, score: 231, data: record }));
    expect(fetchMock.mock.calls[2][0]).toBe(`${API}/sessions/finish`);
    expect(fetchMock.mock.calls[3][0]).toBe(`${API}/telemetry`);
    expect(fetchMock.mock.calls[4][0]).toBe(`${API}/telemetry`);
    expect(fetchMock.mock.calls[5][0]).toBe(`${API}/shares`);
    expect(fetchMock.mock.calls[5][1].body).toBe(JSON.stringify({ sessionId, method: "clipboard" }));
  });

  it("crypto.randomUUID가 없는 환경(HTTPS 아닌 주소)에서도 예외를 던지지 않는다 — 던지면 한 판 끝 결과 화면으로 못 넘어간다", async () => {
    vi.stubGlobal("crypto", {});
    let sent: Promise<void> | undefined;
    expect(() => {
      sent = submitGameRecord("reaction-time", 1, {});
    }).not.toThrow();
    await expect(sent).resolves.toBeUndefined();
    expect(() => recordGameVisit("reaction-time")).not.toThrow();
  });

  it("요청이 실패해도 삼킨다", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    await expect(submitGameRecord("reaction-time", 1, {})).resolves.toBeUndefined();
  });

  it("Given 완료된 게임 When 완료 상태 조회 Then 중도 이탈과 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 202 }))));
    await recordGameVisit("reaction-time");
    expect(wasGameCompleted("reaction-time")).toBe(false);
    await submitGameRecord("reaction-time", 1, {});
    expect(wasGameCompleted("reaction-time")).toBe(true);
  });

  it("Given 플레이 행동 When 전송 Then 텔레메트리 엔드포인트로 보낸다", async () => {
    const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetchMock);
    await recordGameTelemetry("capybara-log-dodge", "jump", { count: 2, distance: 4 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:4000/api/games/capybara-log-dodge/telemetry");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"eventType":"jump"');
  });
});
