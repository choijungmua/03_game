import { beforeEach, describe, expect, it } from "vitest";

import { SATIETY_DECAY_MS } from "./constants";
import { currentSatiety, feedCapybara, feedChat, loadSatiety, parseFeedChat, parseSatiety } from "./feeding";
import { loadFishInventory, recordCatch } from "./fishing";
import { cleanChat } from "./presence";

describe("카피바라 먹이 주기", () => {
  beforeEach(() => localStorage.clear());

  it("가방에서 하나 줄고 포만감이 오른다. 다 먹으면 가방에서 사라진다", () => {
    recordCatch("사과");
    recordCatch("메기");
    const result = feedCapybara("사과", 1000);
    expect(result).toEqual({ ok: true, inventory: { 메기: 1 }, satiety: { value: 10, at: 1000 } });
    expect(loadFishInventory()).toEqual({ 메기: 1 });
    expect(loadSatiety()).toEqual({ value: 10, at: 1000 });
  });

  it("없는 것·물고기·장화·배부를 땐 아무것도 안 바뀐다 (카피바라는 초식동물)", () => {
    expect(feedCapybara("사과", 0)).toEqual({ ok: false, reason: "none" });
    recordCatch("낡은 장화");
    recordCatch("황금 잉어");
    expect(feedCapybara("낡은 장화", 0)).toEqual({ ok: false, reason: "inedible" });
    expect(feedCapybara("황금 잉어", 0)).toEqual({ ok: false, reason: "inedible" });
    for (let i = 0; i < 11; i++) recordCatch("사과");
    for (let i = 0; i < 10; i++) feedCapybara("사과", 0);
    expect(loadSatiety().value).toBe(100);
    expect(feedCapybara("사과", 0)).toEqual({ ok: false, reason: "full" });
    expect(loadFishInventory()).toEqual({ "낡은 장화": 1, "황금 잉어": 1, 사과: 1 });
  });

  it("포만감은 시간이 지나면 떨어지고 0 밑으로 안 간다", () => {
    expect(currentSatiety({ value: 50, at: 0 }, SATIETY_DECAY_MS * 10)).toBe(40);
    expect(currentSatiety({ value: 50, at: 0 }, SATIETY_DECAY_MS * 99)).toBe(0);
    expect(parseSatiety("망가짐")).toEqual({ value: 0, at: 0 });
  });

  it("먹이기 채팅을 그대로 읽고, 평범한 채팅·물고기·장화·모르는 이름은 버린다", () => {
    expect(parseFeedChat(cleanChat(feedChat(1001, "사과")))).toBe("사과");
    expect(parseFeedChat("[[feed:1:황금 잉어]]")).toBeNull();
    expect(parseFeedChat("[[feed:1:낡은 장화]]")).toBeNull();
    expect(parseFeedChat("[[feed:1:상어]]")).toBeNull();
    expect(parseFeedChat("안녕")).toBeNull();
  });
});
