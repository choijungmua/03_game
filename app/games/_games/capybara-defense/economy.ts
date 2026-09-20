import { DEFENSE_RULES, HERO_CLASSES, HERO_TIERS } from "./constants";
import { calculateAttackDamage, calculateUpgradeCost } from "./balance";
import type {
  AttackDamageInput, EconomyState, HeroClass, HeroTier, SharedMoneySpendResult,
  UpgradePreview, UpgradePurchaseResult, UpgradeTarget,
} from "./types";
import { DefenseConfigError, parseHeroClass, parseHeroTier } from "./types";

const CLASS_NAMES: Readonly<Record<HeroClass, string>> = Object.freeze({
  warrior: "전사",
  archer: "궁수",
  rogue: "도적",
  mage: "법사",
});
const TIER_NAMES: Readonly<Record<HeroTier, string>> = Object.freeze({
  common: "일반",
  rare: "희귀",
  epic: "에픽",
  legendary: "전설",
  mythic: "신화",
  primordial: "태초",
});
const INITIAL_CLASS_UPGRADES: Readonly<Record<HeroClass, number>> = Object.freeze({
  warrior: 0,
  archer: 0,
  rogue: 0,
  mage: 0,
});
const INITIAL_TIER_UPGRADES: Readonly<Record<HeroTier, number>> = Object.freeze({
  common: 0,
  rare: 0,
  epic: 0,
  legendary: 0,
  mythic: 0,
  primordial: 0,
});

function assertWholeNonnegative(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new DefenseConfigError(`${name} must be a non-negative integer`);
  }
}

function assertEconomyState(state: EconomyState): void {
  assertWholeNonnegative("Money", state.money);
  assertWholeNonnegative("Kills", state.kills);
  for (const heroClass of HERO_CLASSES) {
    const level = state.classUpgradeLevels[heroClass];
    assertWholeNonnegative("Class upgrade level", level);
    if (level > DEFENSE_RULES.maxUpgradeLevel) {
      throw new DefenseConfigError(`Class upgrade level must not exceed ${DEFENSE_RULES.maxUpgradeLevel}`);
    }
  }
  for (const tier of HERO_TIERS) {
    const level = state.tierUpgradeLevels[tier];
    assertWholeNonnegative("Tier upgrade level", level);
    if (level > DEFENSE_RULES.maxUpgradeLevel) {
      throw new DefenseConfigError(`Tier upgrade level must not exceed ${DEFENSE_RULES.maxUpgradeLevel}`);
    }
  }
}

function getUpgradeLevel(state: EconomyState, target: UpgradeTarget): number {
  switch (target.kind) {
    case "class":
      return state.classUpgradeLevels[target.heroClass];
    case "tier":
      return state.tierUpgradeLevels[target.tier];
  }
}

export function createEconomyState(money: number = DEFENSE_RULES.startingMoney): EconomyState {
  assertWholeNonnegative("Money", money);
  return Object.freeze({
    money,
    kills: 0,
    classUpgradeLevels: INITIAL_CLASS_UPGRADES,
    tierUpgradeLevels: INITIAL_TIER_UPGRADES,
  });
}

export function moneyEarnedForKills(kills: number): number {
  assertWholeNonnegative("Kills", kills);
  return Math.floor(kills / DEFENSE_RULES.moneyPerKills);
}

export function applyKillCount(state: EconomyState, kills: number): EconomyState {
  assertEconomyState(state);
  assertWholeNonnegative("Kills", kills);
  if (kills < state.kills) {
    throw new DefenseConfigError("처치 수는 이전 기록보다 작을 수 없습니다");
  }
  if (kills === state.kills) return state;
  return Object.freeze({
    ...state,
    kills,
    money: state.money + moneyEarnedForKills(kills) - moneyEarnedForKills(state.kills),
  });
}

export function spendSharedMoney(state: EconomyState, cost: number): SharedMoneySpendResult {
  assertEconomyState(state);
  assertWholeNonnegative("Cost", cost);
  if (cost === 0) throw new DefenseConfigError("Cost must be greater than zero");
  if (state.money < cost) {
    return Object.freeze({
      kind: "insufficient-funds",
      state,
      currentMoney: state.money,
      cost,
      missingMoney: cost - state.money,
      message: `돈이 부족해요. 보유 ${state.money}원, 비용 ${cost}원, ${cost - state.money}원이 더 필요해요.`,
    });
  }
  return Object.freeze({ kind: "spent", state: Object.freeze({ ...state, money: state.money - cost }) });
}

export function parseUpgradeTarget(category: string, key: string): UpgradeTarget {
  switch (category) {
    case "class":
      return Object.freeze({ kind: "class", heroClass: parseHeroClass(key) });
    case "tier":
      return Object.freeze({ kind: "tier", tier: parseHeroTier(key) });
    default:
      throw new DefenseConfigError(`Unknown upgrade category: ${category}`);
  }
}

export function getUpgradePreview(state: EconomyState, target: UpgradeTarget): UpgradePreview {
  assertEconomyState(state);
  const currentLevel = getUpgradeLevel(state, target);
  assertWholeNonnegative("Upgrade level", currentLevel);
  if (currentLevel > DEFENSE_RULES.maxUpgradeLevel) {
    throw new DefenseConfigError(`Upgrade level must not exceed ${DEFENSE_RULES.maxUpgradeLevel}`);
  }
  let effectPerLevel: number;
  switch (target.kind) {
    case "class":
      effectPerLevel = DEFENSE_RULES.classUpgradePerLevel;
      break;
    case "tier":
      effectPerLevel = DEFENSE_RULES.tierUpgradePerLevel;
      break;
  }
  const currentEffect = 1 + currentLevel * effectPerLevel;
  if (currentLevel === DEFENSE_RULES.maxUpgradeLevel) {
    return Object.freeze({ target, currentLevel, nextLevel: null, cost: null, currentEffect, nextEffect: currentEffect });
  }
  const nextLevel = currentLevel + 1;
  return Object.freeze({
    target,
    currentLevel,
    nextLevel,
    cost: calculateUpgradeCost(currentLevel),
    currentEffect,
    nextEffect: 1 + nextLevel * effectPerLevel,
  });
}

export function getAttackUpgradePreview(
  input: AttackDamageInput,
  state: EconomyState,
  target: UpgradeTarget,
): Readonly<{ current: number; next: number }> {
  if (
    input.classUpgradeLevel !== state.classUpgradeLevels[input.heroClass]
    || input.tierUpgradeLevel !== state.tierUpgradeLevels[input.tier]
  ) {
    throw new DefenseConfigError("공격력 미리보기의 업그레이드 단계가 현재 상태와 일치하지 않습니다");
  }
  const current = calculateAttackDamage(input);
  const preview = getUpgradePreview(state, target);
  if (preview.nextLevel === null) return Object.freeze({ current, next: current });
  switch (target.kind) {
    case "class":
      return Object.freeze({
        current,
        next: target.heroClass === input.heroClass
          ? calculateAttackDamage({ ...input, classUpgradeLevel: preview.nextLevel })
          : current,
      });
    case "tier":
      return Object.freeze({
        current,
        next: target.tier === input.tier
          ? calculateAttackDamage({ ...input, tierUpgradeLevel: preview.nextLevel })
          : current,
      });
  }
}

export function purchaseUpgrade(state: EconomyState, target: UpgradeTarget): UpgradePurchaseResult {
  const preview = getUpgradePreview(state, target);
  if (preview.nextLevel === null || preview.cost === null) {
    switch (target.kind) {
      case "class":
        return Object.freeze({
          kind: "max-level",
          state,
          message: `${CLASS_NAMES[target.heroClass]} 업그레이드는 이미 최대 ${DEFENSE_RULES.maxUpgradeLevel}단계예요.`,
        });
      case "tier":
        return Object.freeze({
          kind: "max-level",
          state,
          message: `${TIER_NAMES[target.tier]} 업그레이드는 이미 최대 ${DEFENSE_RULES.maxUpgradeLevel}단계예요.`,
        });
    }
  }
  const payment = spendSharedMoney(state, preview.cost);
  if (payment.kind === "insufficient-funds") return payment;
  switch (target.kind) {
    case "class":
      return Object.freeze({
        kind: "purchased",
        target,
        state: Object.freeze({
          ...payment.state,
          classUpgradeLevels: Object.freeze({
            ...payment.state.classUpgradeLevels,
            [target.heroClass]: preview.nextLevel,
          }),
        }),
      });
    case "tier":
      return Object.freeze({
        kind: "purchased",
        target,
        state: Object.freeze({
          ...payment.state,
          tierUpgradeLevels: Object.freeze({
            ...payment.state.tierUpgradeLevels,
            [target.tier]: preview.nextLevel,
          }),
        }),
      });
  }
}
