import { describe, expect, it } from "vitest";

import { DEFENSE_RULES } from "./constants";
import {
  applyKillCount,
  createEconomyState,
  getAttackUpgradePreview,
  getUpgradePreview,
  moneyEarnedForKills,
  parseUpgradeTarget,
  purchaseUpgrade,
  spendSharedMoney,
} from "./economy";

describe("카피바라 디펜스 경제와 업그레이드", () => {
  it("Given 누적 처치 수 When 보상을 계산하면 Then 10마리마다 정수 1원만 지급한다", () => {
    expect([9, 10, 19, 20].map(moneyEarnedForKills)).toEqual([0, 1, 1, 2]);
  });

  it("Given 최신 처치 상태 When 중복되거나 과거 처치 수를 적용하면 Then 돈을 중복 지급하지 않는다", () => {
    const atTwentyKills = applyKillCount(createEconomyState(), 20);

    expect(atTwentyKills.money).toBe(DEFENSE_RULES.startingMoney + 2);
    expect(applyKillCount(atTwentyKills, 20)).toBe(atTwentyKills);
    expect(() => applyKillCount(atTwentyKills, 19)).toThrow("처치 수는 이전 기록보다 작을 수 없습니다");
  });

  it("Given 단계별 업그레이드 When 미리보기를 읽으면 Then 1.6배 비용과 현재·다음 효과를 정확히 보여준다", () => {
    const state = createEconomyState(1_000);
    const target = parseUpgradeTarget("class", "warrior");
    const preview = getUpgradePreview(state, target);

    expect(preview).toMatchObject({ currentLevel: 0, nextLevel: 1, cost: 4, currentEffect: 1, nextEffect: 1.1 });
    expect(Array.from({ length: 10 }, (_, level) => getUpgradePreview(
      { ...state, classUpgradeLevels: { ...state.classUpgradeLevels, warrior: level } },
      target,
    ).cost)).toEqual([4, 7, 11, 17, 27, 42, 68, 108, 172, 275]);
  });

  it("Given 직업과 등급 업그레이드 When 공격력 미리보기를 계산하면 Then 대상만 Task 4 공식으로 바뀐다", () => {
    const state = createEconomyState(1_000);
    const input = { heroClass: "warrior", tier: "legendary", classUpgradeLevel: 0, tierUpgradeLevel: 0, equipmentAttackBonus: 0 } as const;

    expect(getAttackUpgradePreview(input, state, parseUpgradeTarget("class", "warrior"))).toEqual({ current: 77, next: 84.7 });
    expect(getAttackUpgradePreview(input, state, parseUpgradeTarget("tier", "legendary"))).toMatchObject({ current: 77, next: expect.closeTo(83.16, 10) });
    expect(getAttackUpgradePreview(input, state, parseUpgradeTarget("class", "archer"))).toEqual({ current: 77, next: 77 });
    expect(getAttackUpgradePreview(input, state, parseUpgradeTarget("tier", "rare"))).toEqual({ current: 77, next: 77 });
  });

  it("Given 부족한 돈 When 구매를 요청하면 Then 잔액을 유지하고 한국어로 정확한 부족액을 알린다", () => {
    const state = createEconomyState(3);
    const result = purchaseUpgrade(state, parseUpgradeTarget("class", "warrior"));

    expect(result).toEqual({
      kind: "insufficient-funds",
      state,
      currentMoney: 3,
      cost: 4,
      missingMoney: 1,
      message: "돈이 부족해요. 보유 3원, 비용 4원, 1원이 더 필요해요.",
    });
    expect(spendSharedMoney(state, 4)).toMatchObject({ kind: "insufficient-funds", state });
  });

  it("Given 최대 단계 및 잘못된 메뉴 키 When 업그레이드하면 Then 돈을 쓰지 않고 경계를 지킨다", () => {
    const state = createEconomyState(1_000);
    const maxedState = {
      ...state,
      classUpgradeLevels: { ...state.classUpgradeLevels, warrior: DEFENSE_RULES.maxUpgradeLevel },
    };
    const result = purchaseUpgrade(maxedState, parseUpgradeTarget("class", "warrior"));

    expect(result).toEqual({ kind: "max-level", state: maxedState, message: "전사 업그레이드는 이미 최대 10단계예요." });
    expect(() => parseUpgradeTarget("class", "bard")).toThrow("Unknown hero class: bard");
    expect(() => parseUpgradeTarget("rarity", "common")).toThrow("Unknown upgrade category: rarity");
  });

  it("Given 손상되었거나 오래된 상태 When 경제와 미리보기를 사용하면 Then 잘못된 구매를 거부한다", () => {
    const state = createEconomyState();
    const staleInput = { heroClass: "warrior", tier: "common", classUpgradeLevel: 0, tierUpgradeLevel: 0, equipmentAttackBonus: 0 } as const;
    const purchased = purchaseUpgrade(state, parseUpgradeTarget("class", "warrior"));

    if (purchased.kind !== "purchased") throw new Error("Test fixture must afford its first upgrade");
    expect(() => getUpgradePreview({ ...state, money: -1 }, parseUpgradeTarget("class", "warrior"))).toThrow("Money must be a non-negative integer");
    expect(() => spendSharedMoney(state, 1.5)).toThrow("Cost must be a non-negative integer");
    expect(() => getAttackUpgradePreview(staleInput, purchased.state, parseUpgradeTarget("class", "warrior"))).toThrow("공격력 미리보기의 업그레이드 단계가 현재 상태와 일치하지 않습니다");
  });
});
