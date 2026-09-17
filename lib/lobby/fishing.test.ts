import { describe, expect, it, vi } from "vitest";
import { FISH_CHANCES } from "./constants";
import { applyFishEvent, type FishEvent, fishChat, parseFishChat, syncFishing } from "./fishing";
import { cleanChat } from "./presence";

describe("낚시", () => {
  it("확률 합은 100%이고 황금인어는 0.01%다", () => {
    expect(Object.values(FISH_CHANCES).reduce((sum, chance) => sum + chance, 0)).toBe(100);
    expect(FISH_CHANCES.황금인어).toBe(0.01);
  });

  it("낚시 동작을 채팅으로 왕복한다", () => {
    const events: FishEvent[] = [
      { kind: "cast", x: 120, y: -48 },
      { kind: "bite" },
      { kind: "reel", catch: "황금인어" },
      { kind: "reel", catch: null },
    ];
    events.forEach((event, seq) => expect(parseFishChat(cleanChat(fishChat(seq + 998, event)))).toEqual(event));
  });

  it("모르는 물고기와 잘못된 좌표는 버린다", () => {
    expect(parseFishChat("[[fish:1:reel:상어]]")).toBeNull();
    expect(parseFishChat("[[fish:1:cast:1e9:2]]")).toBeNull();
  });

  it("던지기, 입질, 당기기 순서로 줄을 갱신한다", () => {
    const cast = applyFishEvent(null, { kind: "cast", x: 10, y: 20 }, 100);
    const bit = applyFishEvent(cast, { kind: "bite" }, 2000);
    expect(applyFishEvent(bit, { kind: "reel", catch: "메기" }, 2300)).toMatchObject({ biteAt: 2000, reelAt: 2300, catch: "메기" });
  });

  it("서버 상태에서 가방·포만감·애정도·옷만 안전하게 읽는다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        active: false,
        nextCatchAt: null,
        inventory: { 메기: 2, 상어: 99 },
        lastCatch: "메기",
        caughtCount: 0,
        consumed: true,
        feedStatus: "fed",
        satiety: 34,
        affection: 7,
        satietyGain: 20,
        affectionGain: 3,
        outfit: { hat: "straw", glasses: "hacked", wings: "dragon" },
      }),
    );

    await expect(
      syncFishing(
        "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
        "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
        "sync",
      ),
    ).resolves.toMatchObject({
      inventory: { 메기: 2 },
      feedStatus: "fed",
      satiety: { value: 34 },
      affection: 7,
      outfit: { hat: "straw" },
    });
  });

  it("서버가 HTML 오류 페이지를 보내도 JSON 구문 오류를 노출하지 않는다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("<!DOCTYPE html><title>Not Found</title>", {
        status: 404,
        headers: { "Content-Type": "text/html" },
      }),
    );

    await expect(syncFishing("profile", "token", "sync")).rejects.toThrow(
      "게임 서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요",
    );
  });
});
