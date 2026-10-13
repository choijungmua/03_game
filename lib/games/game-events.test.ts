import { afterEach, describe, expect, it, vi } from "vitest";

import { completeGameRound, pauseGameRound, quitGameRound, recordGameShare, recordGameTelemetry, recordGameVisit, resumeGameRound, startGameRound, submitGameRecord, wasGameCompleted } from "./game-events";

const API = "http://localhost:4000/api/games/reaction-time";

afterEach(async () => {
  await quitGameRound("reaction-time");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("게임 이벤트 → 백엔드", () => {
  it("입장·기록·공유를 같은 탭 세션 id로 백엔드에 보낸다", async () => {
    const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetchMock);

    await recordGameVisit("reaction-time");
    await startGameRound("reaction-time");
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
    expect(fetchMock.mock.calls[1][0]).toBe(`${API}/telemetry`);
    expect(fetchMock.mock.calls[2][0]).toBe(`${API}/records`);
    expect(fetchMock.mock.calls[2][1].body).toBe(JSON.stringify({ sessionId, score: 231, data: record }));
    expect(fetchMock.mock.calls[3][0]).toBe(`${API}/sessions/finish`);
    expect(fetchMock.mock.calls[4][0]).toBe(`${API}/telemetry`);
    expect(fetchMock.mock.calls[5][0]).toBe(`${API}/telemetry`);
    expect(fetchMock.mock.calls[6][0]).toBe(`${API}/shares`);
    expect(fetchMock.mock.calls[6][1].body).toBe(JSON.stringify({ sessionId, method: "clipboard" }));
  });

  it("crypto.randomUUID가 없는 환경(HTTPS 아닌 주소)에서도 예외를 던지지 않는다 — 던지면 한 판 끝 결과 화면으로 못 넘어간다", async () => {
    vi.stubGlobal("crypto", {});
    await startGameRound("reaction-time");
    let sent: Promise<void> | undefined;
    expect(() => {
      sent = submitGameRecord("reaction-time", 1, {});
    }).not.toThrow();
    await expect(sent).resolves.toBeUndefined();
    expect(() => recordGameVisit("reaction-time")).not.toThrow();
  });

  it("요청이 실패해도 삼킨다", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    await startGameRound("reaction-time");
    await expect(submitGameRecord("reaction-time", 1, {})).resolves.toBeUndefined();
  });

  it("Given 완료된 게임 When 완료 상태 조회 Then 중도 이탈과 구분한다", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 202 }))));
    await recordGameVisit("reaction-time");
    await startGameRound("reaction-time");
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

  it("방문과 중복 시작은 새 판을 만들지 않고, 일시정지와 결과 대기 시간은 플레이 시간에서 뺀다", async () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetchMock);
    await recordGameVisit("reaction-time");
    await resumeGameRound("reaction-time");
    await quitGameRound("reaction-time");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now = 10_000;
    await startGameRound("reaction-time");
    await startGameRound("reaction-time");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    now = 12_000;
    pauseGameRound("reaction-time");
    now = 22_000;
    await resumeGameRound("reaction-time");
    await resumeGameRound("reaction-time");
    now = 25_000;
    await submitGameRecord("reaction-time", 10, {});
    expect(fetchMock.mock.calls.find(([url]) => url.endsWith("sessions/finish"))?.[1].body).toContain('"durationSeconds":5');
    const completedCalls = fetchMock.mock.calls.length;
    await submitGameRecord("reaction-time", 10, {});
    await quitGameRound("reaction-time");
    expect(fetchMock).toHaveBeenCalledTimes(completedCalls);
    now = 40_000;
    await startGameRound("reaction-time");
    expect(wasGameCompleted("reaction-time")).toBe(false);
    now = 41_000;
    await quitGameRound("reaction-time");
    await quitGameRound("reaction-time");
    expect(fetchMock).toHaveBeenCalledTimes(completedCalls + 2);
    expect(fetchMock.mock.lastCall?.[1].body).toContain('"durationSeconds":1');
    const starts = fetchMock.mock.calls.filter(([, init]) => String(init.body).includes('"game_start"'));
    expect(starts).toHaveLength(2);
    expect(starts[0]?.[1].body).not.toEqual(starts[1]?.[1].body);
    expect(starts[0]?.[1].body).toContain('"metadata":{"roundId":');
  });

  it("점수 기록을 저장하지 않는 0점 판도 완료로 기록하며 재전송하지 않는다", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetchMock);
    await startGameRound("reaction-time");
    await completeGameRound("reaction-time", { value: 0 });
    await completeGameRound("reaction-time", { value: 0 });
    await quitGameRound("reaction-time");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(wasGameCompleted("reaction-time")).toBe(true);
  });

  it("저장소가 차단돼도 같은 탭의 시작과 완료는 같은 세션으로 전송한다", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetchMock);
    await startGameRound("reaction-time");
    await completeGameRound("reaction-time");
    const sessions = fetchMock.mock.calls.map(([, init]) => String(init.body).match(/"sessionId":"([^"]+)"/)?.[1]);
    expect(sessions[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(sessions[1]).toEqual(sessions[0]);
  });
});
