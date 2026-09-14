import { describe, expect, it } from "vitest";

import {
  addBite,
  AWAY_MS_RANGE,
  decayGauge,
  EAT_STEP,
  getFoodStage,
  GLANCE_MS_RANGE,
  LOOK_MS_RANGE,
  pickDuration,
  pickLook,
  pickWarningMs,
  WARNING_MS_RANGE,
} from "./logic";

function sequence(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("pickDuration", () => {
  it("범위 안에서 무작위 시간을 고른다", () => {
    expect(pickDuration(AWAY_MS_RANGE, () => 0)).toBe(AWAY_MS_RANGE.min);
    expect(pickDuration(AWAY_MS_RANGE, () => 1)).toBe(AWAY_MS_RANGE.max);
    expect(pickDuration({ min: 1000, max: 2000 }, () => 0.5)).toBe(1500);
  });
});

describe("pickWarningMs", () => {
  it("경고 시간은 랜덤이다", () => {
    expect(pickWarningMs(0, () => 0)).toBe(WARNING_MS_RANGE.min);
    expect(pickWarningMs(0, () => 1)).toBe(WARNING_MS_RANGE.max);
  });

  it("게이지가 오를수록 가장 긴 경고 시간이 짧아진다", () => {
    const halfway = (WARNING_MS_RANGE.min + WARNING_MS_RANGE.max) / 2;
    expect(pickWarningMs(50, () => 1)).toBe(halfway);
    expect(pickWarningMs(100, () => 1)).toBe(WARNING_MS_RANGE.min);
  });

  it("반응할 시간보다 짧아지지는 않는다", () => {
    expect(WARNING_MS_RANGE.min).toBeGreaterThanOrEqual(300);
  });
});

describe("pickLook", () => {
  it("가끔은 흘끗 보고 바로 돌아선다", () => {
    expect(pickLook(sequence(0.1, 0))).toEqual({ glance: true, ms: GLANCE_MS_RANGE.min });
  });

  it("보통은 한동안 지켜본다", () => {
    expect(pickLook(sequence(0.9, 1))).toEqual({ glance: false, ms: LOOK_MS_RANGE.max });
  });

  it("흘끗 보기는 제대로 보는 것보다 짧다", () => {
    expect(GLANCE_MS_RANGE.max).toBeLessThan(LOOK_MS_RANGE.min);
  });
});

describe("addBite", () => {
  it("한 입은 1%다", () => {
    expect(EAT_STEP).toBe(1);
    expect(addBite(40)).toBe(41);
  });

  it("100%를 넘지 않는다", () => {
    expect(addBite(99)).toBe(100);
    expect(addBite(100)).toBe(100);
  });
});

describe("decayGauge", () => {
  it("1%씩 줄고 0% 아래로는 내려가지 않는다", () => {
    expect(decayGauge(10)).toBe(9);
    expect(decayGauge(0)).toBe(0);
  });
});

describe("getFoodStage", () => {
  it.each([
    [0, "full"],
    [49, "full"],
    [50, "half"],
    [99, "half"],
    [100, "empty"],
  ] as const)("게이지 %i%%면 수박은 %s 단계다", (gauge, stage) => {
    expect(getFoodStage(gauge)).toBe(stage);
  });
});
