import { afterEach, describe, expect, it, vi } from "vitest";

import { syncFishing } from "./server-fishing";

const PROFILE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOKEN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** 서버가 주는 한 판의 상태 */
const STATE = {
  active: true,
  nextCatchAt: "2026-09-18T00:00:00.000Z",
  inventory: { 붕어: 2, 상어: 9, 사과: 1.5, 메기: 0 },
  lastCatch: "붕어",
  caughtCount: 2,
  consumed: false,
  feedStatus: null,
  satiety: 45,
  affection: 12,
  outfit: { hat: "straw", glasses: "없는것" },
};

/** 보낸 요청 본문을 모아 두는 가짜 fetch */
function mockFetch(body: object, ok = true) {
  const sent: string[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit = {}) => {
    sent.push(String(init.body ?? ""));
    return new Response(JSON.stringify(body), { status: ok ? 200 : 503 });
  });
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe("서버 낚시", () => {
  it("모르는 이름·이상한 개수·없는 옷은 버리고 안전한 상태로 읽는다", async () => {
    mockFetch(STATE);

    await expect(syncFishing(PROFILE, TOKEN, "sync")).resolves.toEqual({
      active: true,
      nextCatchAt: "2026-09-18T00:00:00.000Z",
      inventory: { 붕어: 2 },
      lastCatch: "붕어",
      caughtCount: 2,
      consumed: false,
      feedStatus: null,
      satiety: 45,
      affection: 12,
      outfit: { hat: "straw" },
    });
  });

  it("먹일 것·입은 옷을 함께 보낸다", async () => {
    const sent = mockFetch({ ...STATE, consumed: true, feedStatus: "fed" });

    const state = await syncFishing(PROFILE, TOKEN, "consume", "사과");

    expect(state.consumed).toBe(true);
    expect(state.feedStatus).toBe("fed");
    expect(JSON.parse(sent[0])).toEqual({ profileId: PROFILE, token: TOKEN, command: "consume", catch: "사과", outfit: null });
  });

  it("서버가 실패하거나 모양이 다르면 한국어 오류를 던진다", async () => {
    mockFetch({ error: "낚시 서버에 연결할 수 없어요" }, false);
    await expect(syncFishing(PROFILE, TOKEN, "sync")).rejects.toThrow("게임 서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요");

    mockFetch({ ok: true });
    await expect(syncFishing(PROFILE, TOKEN, "sync")).rejects.toThrow("게임 서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요");
  });
});
