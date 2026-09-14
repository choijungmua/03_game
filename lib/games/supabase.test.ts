import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recordGameShare, recordGameVisit, submitGameRecord } from "./supabase";

const RPC = "https://example.supabase.co/rest/v1/rpc";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("Supabase RPC", () => {
  it("입장과 기록을 같은 탭 세션 id로 보낸다", async () => {
    const fetchMock = vi.fn((_input: string, _init: RequestInit) => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);

    await recordGameVisit("reaction-time");
    const record = { id: "1", ms: 231, at: 1 };
    await submitGameRecord("reaction-time", record.ms, record);

    const sessionId = sessionStorage.getItem("game-session-id");
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(fetchMock).toHaveBeenNthCalledWith(1, `${RPC}/g_add_visit`, {
      method: "POST",
      headers: { apikey: "sb_publishable_test", "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: "reaction-time", p_session_id: sessionId }),
      keepalive: true,
    });
    expect(fetchMock.mock.calls[1][0]).toBe(`${RPC}/g_add_record`);
    expect(fetchMock.mock.calls[1][1].body).toBe(
      JSON.stringify({ p_slug: "reaction-time", p_session_id: sessionId, p_score: 231, p_data: record }),
    );

    await recordGameShare("reaction-time", "clipboard");
    expect(fetchMock.mock.calls[2][0]).toBe(`${RPC}/g_add_share`);
    expect(fetchMock.mock.calls[2][1].body).toBe(
      JSON.stringify({ p_slug: "reaction-time", p_session_id: sessionId, p_method: "clipboard" }),
    );
  });

  it("환경변수가 없으면 요청하지 않고, 요청 실패도 삼킨다", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await recordGameVisit("reaction-time");
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    await expect(submitGameRecord("reaction-time", 1, {})).resolves.toBeUndefined();
  });
});
