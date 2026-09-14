import { describe, expect, it } from "vitest";

import { getTier, getTierRangeLabel, REACTION_TIERS } from "./tiers";

describe("getTier", () => {
  it.each([
    [0, "프로게이머"],
    [149, "프로게이머"],
    [150, "게이머"],
    [199, "게이머"],
    [200, "정상인"],
    [259, "정상인"],
    [260, "조금 느림"],
    [349, "조금 느림"],
    [350, "거북이"],
    [5000, "거북이"],
  ])("%ims는 %s 등급이다", (ms, label) => {
    expect(getTier(ms).label).toBe(label);
  });
});

describe("getTierRangeLabel", () => {
  it("첫 등급은 미만, 마지막 등급은 이상, 중간은 범위로 표시한다", () => {
    expect(getTierRangeLabel(REACTION_TIERS[0])).toBe("150ms 미만");
    expect(getTierRangeLabel(REACTION_TIERS[1])).toBe("150–199ms");
    expect(getTierRangeLabel(REACTION_TIERS[REACTION_TIERS.length - 1])).toBe("350ms 이상");
  });
});
