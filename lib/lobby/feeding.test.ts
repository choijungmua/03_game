import { describe, expect, it } from "vitest";

import { SATIETY_DECAY_MS } from "./constants";
import { currentSatiety, feedChat, parseFeedChat, satietyWalkSpeed } from "./feeding";
import { cleanChat } from "./presence";

describe("카피바라 먹이 주기", () => {
  it("서버에서 받은 포만감은 다음 동기화 전까지 시간만큼 떨어지고 0 밑으로 안 간다", () => {
    expect(currentSatiety({ value: 50, at: 0 }, SATIETY_DECAY_MS * 10)).toBe(40);
    expect(currentSatiety({ value: 50, at: 0 }, SATIETY_DECAY_MS * 99)).toBe(0);
  });

  it("배가 비면 걸음이 조금 느려지고 배가 차면 원래 속도로 걷는다", () => {
    expect(satietyWalkSpeed({ value: 0, at: 0 }, 0)).toBe(0.85);
    expect(satietyWalkSpeed({ value: 50, at: 0 }, 0)).toBeCloseTo(0.925);
    expect(satietyWalkSpeed({ value: 100, at: 0 }, 0)).toBe(1);
  });

  it("먹이기 채팅을 그대로 읽고, 평범한 채팅·물고기·장화·모르는 이름은 버린다", () => {
    expect(parseFeedChat(cleanChat(feedChat(1001, "사과")))).toBe("사과");
    expect(parseFeedChat("[[feed:1:황금 잉어]]")).toBeNull();
    expect(parseFeedChat("[[feed:1:낡은 장화]]")).toBeNull();
    expect(parseFeedChat("[[feed:1:상어]]")).toBeNull();
    expect(parseFeedChat("안녕")).toBeNull();
  });
});
