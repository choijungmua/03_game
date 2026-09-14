import { afterEach, describe, expect, it, vi } from "vitest";

import { recordGameVisit } from "./visit-tracker";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("recordGameVisit", () => {
  it("slug와 탭 세션 id를 record_game_visit RPC로 보내고, 같은 탭에서는 같은 세션 id를 쓴다", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const fetchMock = vi.fn((_input: string, _init: RequestInit) => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);

    await recordGameVisit("reaction-time");
    await recordGameVisit("click-speed");

    const sessionId = sessionStorage.getItem("visit-session-id");
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://example.supabase.co/rest/v1/rpc/record_game_visit", {
      method: "POST",
      headers: { apikey: "sb_publishable_test", "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: "reaction-time", p_session_id: sessionId }),
      keepalive: true,
    });
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ p_slug: "click-speed", p_session_id: sessionId }));
  });

  it("환경변수가 없으면 요청하지 않고, 요청 실패도 삼킨다", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await recordGameVisit("reaction-time");
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    await expect(recordGameVisit("reaction-time")).resolves.toBeUndefined();
  });
});
