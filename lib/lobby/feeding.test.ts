import { describe, expect, it } from "vitest";
import { FOOD_AFFECTION, FOOD_SATIETY, SATIETY_DECAY_MS } from "./constants";
import { currentSatiety, feedChat, parseFeedChat } from "./feeding";
import { cleanChat } from "./presence";

describe("카피바라 먹이", () => {
  it("먹이마다 포만감과 애정도가 다르고 장화는 먹을 수 없다", () => {
    expect(FOOD_SATIETY).toMatchObject({ 송사리: 8, 메기: 20, 황금인어: 35, "낡은 장화": 0 });
    expect(FOOD_AFFECTION).toMatchObject({ 송사리: 1, 메기: 3, 황금인어: 8, "낡은 장화": 0 });
  });

  it("포만감은 시간에 따라 줄어든다", () => {
    expect(currentSatiety({ value: 50, at: 0 }, SATIETY_DECAY_MS * 10)).toBe(40);
    expect(currentSatiety({ value: 100, at: 0 }, SATIETY_DECAY_MS * 101)).toBe(0);
  });

  it("먹이기 채팅은 먹을 수 있는 것만 읽는다", () => {
    expect(parseFeedChat(cleanChat(feedChat(1001, "황금인어")))).toBe("황금인어");
    expect(parseFeedChat("[[feed:1:낡은 장화]]")).toBeNull();
  });
});
