import { describe, expect, it } from "vitest";

import {
  calculateAttackDamage,
  createSeededRandom,
  getRoundConfig,
  parseHeroClass,
  parseHeroTier,
  parseMapId,
  simulateDefenseRun,
  validateProbabilityTable,
  weightedPick,
} from "./balance";
import {
  DEFENSE_RULES,
  BOSSES,
  CLASS_WEIGHTS,
  EQUIPMENT_RARITY_WEIGHTS,
  EQUIPMENT_SLOT_WEIGHTS,
  GACHA_WEIGHTS,
  HERO_CLASSES,
  HERO_STATS,
  HERO_TIERS,
  MAPS,
  MONSTER_THEMES,
  SKILLS,
  TIER_MULTIPLIERS,
  WEAPON_ATTACK_BONUS,
} from "./constants";

describe("카피바라 디펜스 밸런스 계약", () => {
  it("Given 고정 콘텐츠 When 계약을 읽으면 Then 3맵·4직업·6등급과 확률표가 완전하다", () => {
    expect(MAPS).toHaveLength(3);
    expect(HERO_CLASSES).toEqual(["warrior", "archer", "rogue", "mage"]);
    expect(HERO_TIERS).toEqual(["common", "rare", "epic", "legendary", "mythic", "primordial"]);
    expect(Object.keys(HERO_STATS)).toEqual(HERO_CLASSES);
    expect(HERO_CLASSES.map((heroClass) => HERO_STATS[heroClass].baseAttack)).toEqual([14, 9, 8, 11]);
    expect(HERO_TIERS.map((tier) => TIER_MULTIPLIERS[tier])).toEqual([1, 1.8, 3.2, 5.5, 9, 15]);
    expect(SKILLS).toHaveLength(8);
    expect(BOSSES).toHaveLength(10);
    expect(MONSTER_THEMES).toHaveLength(100);
    expect(
      MONSTER_THEMES.slice(1).every((theme, index) => {
        const previous = MONSTER_THEMES[index];
        return theme.body !== previous.body || theme.hue !== previous.hue;
      }),
    ).toBe(true);
    expect(DEFENSE_RULES).toMatchObject({
      startingLife: 20,
      startingMoney: 10,
      drawCost: 3,
      mergeCount: 3,
      topTierConversionCost: 50,
      ticketEveryRounds: 15,
      ticketChallengeSuccessChance: 0.2,
      normalEquipmentDropChance: 0.02,
      bossEquipmentDrops: 1,
      upgradeCostGrowth: 1.6,
      maxUpgradeLevel: 10,
    });
    expect(Object.values(GACHA_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
    expect(Object.values(EQUIPMENT_RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
    expect(EQUIPMENT_RARITY_WEIGHTS).toEqual({
      common: 60,
      rare: 25,
      epic: 10,
      legendary: 4,
      mythic: 0.9,
      primordial: 0.1,
    });
    expect(EQUIPMENT_SLOT_WEIGHTS).toEqual({ weapon: 45, armor: 30, accessory: 25 });
    expect(WEAPON_ATTACK_BONUS).toEqual({
      common: 0.05,
      rare: 0.1,
      epic: 0.18,
      legendary: 0.3,
      mythic: 0.5,
      primordial: 0.8,
    });
  });

  it("Given 최하 등급 뽑기 When 충분한 고정 난수 표본을 뽑으면 Then 네 직업이 모두 나온다", () => {
    const random = createSeededRandom(24_091);
    const seen = new Set(
      Array.from({ length: 200 }, () => weightedPick(HERO_CLASSES, CLASS_WEIGHTS, random)),
    );

    expect(seen).toEqual(new Set(HERO_CLASSES));
  });

  it("Given 업그레이드와 장비 When 최종 공격력을 계산하면 Then 명세 순서의 곱셈식을 따른다", () => {
    expect(
      calculateAttackDamage({
        heroClass: "warrior",
        tier: "legendary",
        classUpgradeLevel: 3,
        tierUpgradeLevel: 2,
        equipmentAttackBonus: 0.3,
      }),
    ).toBeCloseTo(14 * 5.5 * 1.3 * 1.16 * 1.3, 10);
  });

  it("Given 1~100라운드 When 일정을 생성하면 Then 보스·보호막·빠른 적·쌍 스폰 규칙을 지킨다", () => {
    const rounds = Array.from({ length: DEFENSE_RULES.totalRounds }, (_, index) => getRoundConfig(index + 1));

    expect(rounds.filter((round) => round.kind === "boss").map((round) => round.round)).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
    expect(rounds.filter((round) => round.kind === "shield").map((round) => round.round)).toEqual([
      5, 15, 25, 35, 45, 55, 65, 75, 85, 95,
    ]);
    expect(rounds.every((round) => round.spawnCount % 2 === 0)).toBe(true);
    expect(rounds.every((round) => round.withinPairDelayMs === 250 && round.betweenPairDelayMs === 650)).toBe(true);
    expect(Math.min(...rounds.map((round) => round.fastEnemyResponseMs))).toBeGreaterThanOrEqual(1_500);
  });

  it("Given 같은 시드 When 100라운드를 두 번 계산하면 Then 결과가 완전히 동일하다", () => {
    const first = simulateDefenseRun("reed-marsh", 77);
    const second = simulateDefenseRun("reed-marsh", 77);

    expect(second).toEqual(first);
    expect(first.draws).toBeGreaterThan(0);
    expect(first.merges).toBeGreaterThan(0);
    expect(first.classUpgradePurchases + first.tierUpgradePurchases).toBeGreaterThan(0);
    expect(first.equipmentDrops).toBeGreaterThan(0);
    expect(first.damageDealt).toBeGreaterThan(0);
  });

  it("Given 무지출 전략 When 실제 전투를 진행하면 Then 생명을 잃고 100라운드 전에 패배한다", () => {
    const run = simulateDefenseRun("reed-marsh", 77, { policy: "no-spend" });

    expect(run.cleared).toBe(false);
    expect(run.failedRound).not.toBeNull();
    expect(run.roundsCompleted).toBeLessThan(100);
    expect(run.livesRemaining).toBeLessThanOrEqual(0);
    expect(run.totalLeaks).toBeGreaterThan(0);
  });

  it("Given 동일한 전략과 시드 When 적 체력을 크게 올리면 Then 기준 완주 결과가 패배로 바뀐다", () => {
    const baseline = simulateDefenseRun("reed-marsh", 77);
    const perturbed = simulateDefenseRun("reed-marsh", 77, { enemyHealthMultiplier: 6 });

    expect(baseline.cleared).toBe(true);
    expect(perturbed.cleared).toBe(false);
    expect(perturbed.scheduleChecksum).not.toBe(baseline.scheduleChecksum);
  });

  it("Given 3맵×100시드 When 밸런스를 스윕하면 Then 완주시간·경제·일정을 모두 만족한다", () => {
    const runs = MAPS.flatMap((map) =>
      Array.from({ length: 100 }, (_, seed) => simulateDefenseRun(map.id, seed + 1)),
    );

    expect(runs).toHaveLength(300);
    expect(runs.every((run) => run.cleared && run.roundsCompleted === 100)).toBe(true);
    expect(runs.every((run) => run.estimatedClearMinutes >= 55 && run.estimatedClearMinutes <= 75)).toBe(true);
    expect(runs.every((run) => run.minimumMoney >= 0)).toBe(true);
    expect(runs.every((run) => run.bossRounds === 10 && run.shieldRounds === 10)).toBe(true);
  });

  it("Given 잘못된 외부 설정 When 파싱하면 Then 라운드 시작 전에 구체적인 오류로 거부한다", () => {
    expect(() => validateProbabilityTable("test rarity", { common: 60, rare: 39.9 }, ["common", "rare"])).toThrow(
      "test rarity probability must total 100; received 99.9",
    );
    expect(() => validateProbabilityTable("test rarity", { common: 100 }, ["common", "rare"])).toThrow(
      "test rarity probability keys must match: common, rare",
    );
    expect(() => validateProbabilityTable("test rarity", { common: 60, rare: 40, ancient: 0 }, ["common", "rare"])).toThrow(
      "test rarity probability keys must match: common, rare",
    );
    expect(() => parseHeroTier("ancient")).toThrow("Unknown hero tier: ancient");
    expect(() => parseHeroClass("bard")).toThrow("Unknown hero class: bard");
    expect(() => parseMapId("lava-field")).toThrow("Unknown defense map: lava-field");
  });
});
