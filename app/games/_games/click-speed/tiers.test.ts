import { describe, expect, it } from "vitest";

import { CLICK_SPEED_TIERS, getClickSpeedTier, getClickSpeedTierRangeLabel } from "./tiers";

describe("getClickSpeedTier", () => {
  it.each([
    [12, "프로게이머"],
    [10, "프로게이머"],
    [9.9, "게이머"],
    [8, "게이머"],
    [7.9, "정상인"],
    [6, "정상인"],
    [5.9, "조금 느림"],
    [4, "조금 느림"],
    [3.9, "거북이"],
    [0, "거북이"],
  ])("초당 %d회는 %s 등급이다", (cps, label) => {
    expect(getClickSpeedTier(cps).label).toBe(label);
  });
});

describe("getClickSpeedTierRangeLabel", () => {
  it("첫 등급은 이상, 마지막 등급은 미만, 중간은 범위로 표시한다", () => {
    expect(getClickSpeedTierRangeLabel(CLICK_SPEED_TIERS[0])).toBe("10회/초 이상");
    expect(getClickSpeedTierRangeLabel(CLICK_SPEED_TIERS[1])).toBe("8–9.9회/초");
    expect(getClickSpeedTierRangeLabel(CLICK_SPEED_TIERS[CLICK_SPEED_TIERS.length - 1])).toBe(
      "4회/초 미만",
    );
  });
});
