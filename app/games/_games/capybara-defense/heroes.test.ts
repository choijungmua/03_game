import { describe, expect, it } from "vitest";

import { createSeededRandom } from "./balance";
import { DEFENSE_RULES, GACHA_WEIGHTS, HERO_CLASSES, HERO_TIERS } from "./constants";
import {
  TICKET_OFFER,
  awardRoundTicket,
  confirmMerge,
  convertTopTier,
  createHeroInventory,
  createHeroUnit,
  drawHero,
  getAdjustedTierProbabilities,
  previewMerge,
  redeemTicket,
  rollHero,
  undoMerge,
} from "./heroes";
import type { HeroClass, HeroInventory, HeroTier, HeroUnit } from "./types";
import { createEconomyState } from "./economy";

function withInventory(
  units: readonly HeroUnit[],
  options: { readonly money?: number; readonly tickets?: number; readonly nextUnitId?: number } = {},
): HeroInventory {
  return Object.freeze({
    units: Object.freeze([...units]),
    economy: createEconomyState(options.money ?? 0),
    tickets: options.tickets ?? 0,
    awardedTicketRounds: Object.freeze([]),
    nextUnitId: options.nextUnitId ?? units.length + 1,
    drawState: Object.freeze({ lowTierStreak: 0, missingClassStreak: 0 }),
  });
}

describe("카피바라 디펜스 영웅 뽑기", () => {
  it("Given 기본 확률과 고정 시드 When 10만 번 뽑으면 Then 공개 확률 허용 오차와 최하위 네 직업을 만족한다", () => {
    // Given
    const random = createSeededRandom(80_081);
    const tierCounts: Record<HeroTier, number> = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0, primordial: 0 };
    const classCounts: Record<HeroClass, number> = { warrior: 0, archer: 0, rogue: 0, mage: 0 };
    const commonClasses = new Set<string>();

    // When
    for (let index = 0; index < 100_000; index += 1) {
      const roll = rollHero(random, { lowTierStreak: 0, missingClassStreak: 0 }, HERO_CLASSES);
      tierCounts[roll.tier] += 1;
      classCounts[roll.heroClass] += 1;
      if (roll.tier === "common") commonClasses.add(roll.heroClass);
    }

    // Then
    const tolerances: Record<HeroTier, number> = { common: 0.6, rare: 0.6, epic: 0.4, legendary: 0.25, mythic: 0.1, primordial: 0.04 };
    for (const tier of HERO_TIERS) {
      expect(Math.abs(tierCounts[tier] / 1_000 - GACHA_WEIGHTS[tier])).toBeLessThanOrEqual(tolerances[tier]);
    }
    for (const heroClass of HERO_CLASSES) {
      expect(Math.abs(classCounts[heroClass] / 1_000 - 25)).toBeLessThanOrEqual(0.5);
    }
    expect(commonClasses).toEqual(new Set(HERO_CLASSES));
  });

  it("Given 한 직업만 보유하고 일곱 번 누락 When 다음 영웅을 뽑으면 Then 없는 직업이 확정되고 천장 확률이 공개된다", () => {
    // Given
    const state = { lowTierStreak: DEFENSE_RULES.lowTierPityStartsAfter, missingClassStreak: DEFENSE_RULES.missingClassGuaranteeDraws - 1 };

    // When
    const roll = rollHero(() => 0, state, ["warrior"]);
    const adjusted = getAdjustedTierProbabilities(state.lowTierStreak);

    // Then
    expect(roll.guaranteedMissingClass).toBe(true);
    expect(roll.heroClass).toBe("archer");
    expect(adjusted.common).toBeLessThan(GACHA_WEIGHTS.common);
    expect(HERO_TIERS.slice(1).every((tier) => adjusted[tier] > GACHA_WEIGHTS[tier])).toBe(true);
    expect(Object.values(adjusted).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 10);
  });

  it("Given 잘못된 천장 연속 횟수 When 확률을 계산하면 Then 구체적인 설정 오류로 거부한다", () => {
    // Given / When / Then
    expect(() => getAdjustedTierProbabilities(-1)).toThrow("Low-tier pity streak must be a non-negative integer");
  });
});

describe("카피바라 디펜스 영웅 행동", () => {
  it("Given 돈과 슬롯 경계 When 뽑으면 Then 성공 때만 비용과 슬롯을 사용한다", () => {
    // Given
    const exactMoney = createHeroInventory(DEFENSE_RULES.drawCost);
    const noMoney = createHeroInventory(DEFENSE_RULES.drawCost - 1);
    const full = withInventory([createHeroUnit("hero-1", "warrior", "common")], { money: DEFENSE_RULES.drawCost, nextUnitId: 2 });

    // When
    const success = drawHero(exactMoney, () => 0);
    const insufficient = drawHero(noMoney, () => 0);
    const noSlot = drawHero(full, () => 0, 1);

    // Then
    expect(success.ok && success.state.economy.money).toBe(0);
    expect(success.ok && success.unit.id).toBe("hero-1");
    expect(insufficient).toEqual({ ok: false, reason: "insufficient-currency", state: noMoney });
    expect(noSlot).toEqual({ ok: false, reason: "inventory-full", state: full });
  });

  it("Given 같은 등급 세 유닛 When 미리보기·합성·되돌리기하면 Then 정확한 원본 ID·능력치·장비가 복구된다", () => {
    // Given
    const originals = [
      createHeroUnit("hero-1", "warrior", "rare", { attackBonus: 2, kills: 11 }, { weapon: "reed-spear" }),
      createHeroUnit("hero-2", "archer", "rare", { attackBonus: 4, kills: 7 }, { armor: "leaf-vest" }),
      createHeroUnit("hero-3", "mage", "rare", { attackBonus: 1, kills: 19 }, { accessory: "yuzu-bell" }),
    ] as const;
    const state = withInventory(originals, { nextUnitId: 4 });

    // When
    const preview = previewMerge(state, ["hero-1", "hero-2", "hero-3"]);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const merged = confirmMerge(state, preview.preview, 1_000, () => 0.75);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    const restored = undoMerge(merged.state, merged.undo, 1_000 + DEFENSE_RULES.mergeUndoMs);

    // Then
    expect(preview.preview.consumedUnits).toEqual(originals);
    expect(preview.preview.resultTier).toBe("epic");
    expect(merged.state.units).toHaveLength(1);
    expect(merged.unit.id).toBe("hero-4");
    expect(restored.ok && restored.state.units).toEqual(originals);
  });

  it("Given 합성 후 상태 변경 또는 만료 When 확인·되돌리기하면 Then 유닛을 중복시키지 않는다", () => {
    // Given
    const units = [
      createHeroUnit("hero-1", "warrior", "common"),
      createHeroUnit("hero-2", "archer", "common"),
      createHeroUnit("hero-3", "mage", "common"),
    ] as const;
    const state = withInventory(units, { nextUnitId: 4 });
    const preview = previewMerge(state, ["hero-1", "hero-2", "hero-3"]);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const dirtyState = withInventory([createHeroUnit("hero-1", "warrior", "common", { attackBonus: 99, kills: 0 }), units[1], units[2]], { nextUnitId: 4 });
    const stale = confirmMerge(dirtyState, preview.preview, 0, () => 0);
    const misleading = confirmMerge(state, { ...preview.preview, resultTier: "primordial" }, 0, () => 0);
    const merged = confirmMerge(state, preview.preview, 0, () => 0);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    const malformedUndo = undoMerge(
      merged.state,
      { ...merged.undo, consumedUnits: [units[0], units[0], units[2]] },
      1,
    );

    // When
    const expired = undoMerge(merged.state, merged.undo, DEFENSE_RULES.mergeUndoMs + 1);

    // Then
    expect(stale).toEqual({ ok: false, reason: "stale-preview", state: dirtyState });
    expect(misleading).toEqual({ ok: false, reason: "stale-preview", state });
    expect(malformedUndo).toEqual({ ok: false, reason: "stale-undo", state: merged.state });
    expect(expired).toEqual({ ok: false, reason: "expired-undo", state: merged.state });
    expect(expired.state.units).toEqual([merged.unit]);
  });

  it("Given 세 개가 아닌 선택 When 합성 미리보기를 요청하면 Then 아무 유닛도 소비하지 않는다", () => {
    // Given
    const units = [createHeroUnit("hero-1", "warrior", "common"), createHeroUnit("hero-2", "archer", "common")] as const;
    const state = withInventory(units, { nextUnitId: 3 });

    // When
    const result = previewMerge(state, ["hero-1", "hero-2"]);

    // Then
    expect(result).toEqual({ ok: false, reason: "ineligible-merge", state });
    expect(state.units).toEqual(units);
  });

  it("Given 1~100라운드 When 티켓을 지급하면 Then 15의 배수 6회만 중복 없이 지급한다", () => {
    // Given
    let state = createHeroInventory();

    // When
    for (let round = 1; round <= 100; round += 1) {
      state = awardRoundTicket(state, round);
      state = awardRoundTicket(state, round);
    }

    // Then
    expect(state.tickets).toBe(6);
    expect(state.awardedTicketRounds).toEqual([15, 30, 45, 60, 75, 90]);
  });

  it("Given 티켓 When 직업 선택을 확인 전후로 사용하면 Then 확인 후에만 선택한 5등급을 지급한다", () => {
    // Given
    const state = withInventory([], { tickets: 1 });

    // When
    const pending = redeemTicket(state, { kind: "choice", heroClass: "rogue" }, false, () => 0);
    const redeemed = redeemTicket(state, { kind: "choice", heroClass: "rogue" }, true, () => 0);

    // Then
    expect(pending).toEqual({ ok: false, reason: "confirmation-required", state });
    expect(redeemed.ok && redeemed.unit).toMatchObject({ heroClass: "rogue", tier: "mythic" });
    expect(redeemed.ok && redeemed.state.tickets).toBe(0);
  });

  it("Given 랜덤 도전 When 실패 시드로 확인하면 Then 20%·무보상 안내대로 티켓만 소비한다", () => {
    // Given
    const state = withInventory([], { tickets: 1 });

    // When
    const failed = redeemTicket(state, { kind: "challenge" }, true, () => 0.9);

    // Then
    expect(TICKET_OFFER).toMatchObject({ challengeSuccessChance: 0.2, challengeFailureReward: "none", requiresConfirmation: true });
    expect(failed.ok && failed.unit).toBeNull();
    expect(failed.ok && failed.state.tickets).toBe(0);
    expect(failed.ok && failed.state.units).toEqual([]);
  });

  it("Given 랜덤 도전 When 성공 시드로 확인하면 Then 무작위 직업 6등급 한 명만 지급한다", () => {
    // Given
    const state = withInventory([], { tickets: 1 });
    const samples = [0.19, 0.74];
    const random = (): number => samples.shift() ?? 0;

    // When
    const result = redeemTicket(state, { kind: "challenge" }, true, random);

    // Then
    expect(result.ok && result.unit).toMatchObject({ heroClass: "rogue", tier: "primordial" });
    expect(result.ok && result.state.units).toHaveLength(1);
    expect(result.ok && result.state.tickets).toBe(0);
  });

  it("Given 티켓과 가득 찬 슬롯 When 사용하면 Then 티켓을 보존한다", () => {
    // Given
    const state = withInventory([createHeroUnit("hero-1", "warrior", "common")], { tickets: 1, nextUnitId: 2 });

    // When
    const result = redeemTicket(state, { kind: "challenge" }, true, () => 0, 1);

    // Then
    expect(result).toEqual({ ok: false, reason: "inventory-full", state });
  });

  it("Given 최고 등급과 충분한 비용 When 전환하면 Then 다른 직업으로만 바뀌며 그 외 상태는 보존된다", () => {
    // Given
    const unit = createHeroUnit("hero-1", "warrior", "primordial", { attackBonus: 8, kills: 88 }, { weapon: "moon-blade" });
    const state = withInventory([unit], { money: DEFENSE_RULES.topTierConversionCost, nextUnitId: 2 });

    // When
    const converted = convertTopTier(state, unit.id, () => 0);
    const noMoney = convertTopTier(withInventory([unit], { money: DEFENSE_RULES.topTierConversionCost - 1, nextUnitId: 2 }), unit.id, () => 0);
    const lowTier = convertTopTier(withInventory([createHeroUnit("hero-1", "warrior", "mythic")], { money: 999, nextUnitId: 2 }), unit.id, () => 0);

    // Then
    expect(converted.ok && converted.unit).toEqual({ ...unit, heroClass: "archer" });
    expect(converted.ok && converted.state.economy.money).toBe(0);
    expect(noMoney.ok || noMoney.reason).toBe("insufficient-currency");
    expect(lowTier.ok || lowTier.reason).toBe("not-top-tier");
  });
});
