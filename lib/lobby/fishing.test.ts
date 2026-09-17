import { beforeEach, describe, expect, it } from "vitest";

import {
  applyFishEvent,
  type FishEvent,
  fishChat,
  loadFishInventory,
  parseFishChat,
  parseFishInventory,
  recordCatch,
} from "./fishing";
import { cleanChat } from "./presence";

describe("낚시 가방", () => {
  beforeEach(() => localStorage.clear());

  it("망가지거나 이상한 저장값은 버린다", () => {
    expect(parseFishInventory(null)).toEqual({});
    expect(parseFishInventory("망가짐")).toEqual({});
    expect(parseFishInventory("[1,2]")).toEqual({});
    expect(parseFishInventory(JSON.stringify({ 붕어: 3, 메기: -1, 피라냐: 1.5, 상어: 9, 송사리: "2" }))).toEqual({ 붕어: 3 });
  });

  it("낚을 때마다 하나씩 쌓여 저장된다", () => {
    recordCatch("붕어");
    recordCatch("붕어");
    expect(recordCatch("메기")).toEqual({ 붕어: 2, 메기: 1 });
    expect(loadFishInventory()).toEqual({ 붕어: 2, 메기: 1 });
  });
});

describe("낚시 동작 채팅", () => {
  it("보낸 동작을 그대로 읽고, 채팅 정리(cleanChat)를 거쳐도 같다", () => {
    const events: FishEvent[] = [
      { kind: "cast", x: 120, y: -48 },
      { kind: "bite" },
      { kind: "reel", catch: "황금 잉어" },
      { kind: "reel", catch: null },
    ];
    events.forEach((event, seq) => expect(parseFishChat(cleanChat(fishChat(seq + 998, event)))).toEqual(event));
  });

  it("평범한 채팅·모르는 물고기·이상한 좌표는 낚시 동작이 아니다", () => {
    expect(parseFishChat("안녕")).toBeNull();
    expect(parseFishChat("[[emote:3]]")).toBeNull();
    expect(parseFishChat("[[fish:1:reel:상어]]")).toBeNull();
    expect(parseFishChat("[[fish:1:cast:]]")).toBeNull();
    expect(parseFishChat("[[fish:1:cast:1e9:2]]")).toBeNull();
  });

  it("던지기 → 입질 → 당기기 순서로 줄이 채워지고, 던지기를 못 봤으면 버린다", () => {
    const cast = applyFishEvent(null, { kind: "cast", x: 10, y: 20 }, 100);
    expect(cast).toEqual({ x: 10, y: 20, castAt: 100, biteAt: Infinity, reelAt: Infinity, catch: null });
    const bit = applyFishEvent(cast, { kind: "bite" }, 2000);
    expect(applyFishEvent(bit, { kind: "reel", catch: "메기" }, 2300)).toMatchObject({ biteAt: 2000, reelAt: 2300, catch: "메기" });
    expect(applyFishEvent(null, { kind: "reel", catch: "메기" }, 2300)).toBeNull();
  });
});
