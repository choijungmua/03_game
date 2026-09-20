import type {
  HeroClass,
  HeroInventory,
  HeroTier,
  HeroUnit,
  HeroUnitId,
  ProbabilityTable,
  RandomSource,
} from "./types";
import { DefenseConfigError } from "./types";
import { calculateAttackDamage, weightedPick } from "./balance";
import { createEconomyState, purchaseUpgrade, spendSharedMoney } from "./economy";
import type { EconomyState, UpgradeTarget } from "./types";
import {
  CLASS_WEIGHTS,
  DEFENSE_RULES,
  EQUIPMENT_SLOTS,
  GACHA_WEIGHTS,
  HERO_CLASSES,
  HERO_TIERS,
} from "./constants";

export type HeroRoll = {
  readonly heroClass: HeroClass;
  readonly tier: HeroTier;
  readonly probabilities: ProbabilityTable<HeroTier>;
  readonly guaranteedMissingClass: boolean;
  readonly drawState: HeroInventory["drawState"];
};

export type HeroActionFailureReason =
  | "confirmation-required"
  | "expired-undo"
  | "ineligible-merge"
  | "insufficient-currency"
  | "inventory-full"
  | "missing-unit"
  | "no-ticket"
  | "not-top-tier"
  | "stale-preview"
  | "stale-undo";

export type HeroActionFailure = {
  readonly ok: false;
  readonly reason: HeroActionFailureReason;
  readonly state: HeroInventory;
};

export type HeroUpgradePurchaseResult =
  | { readonly kind: "purchased"; readonly state: HeroInventory; readonly target: UpgradeTarget }
  | { readonly kind: "max-level"; readonly state: HeroInventory; readonly message: string }
  | {
    readonly kind: "insufficient-funds";
    readonly state: HeroInventory;
    readonly currentMoney: number;
    readonly cost: number;
    readonly missingMoney: number;
    readonly message: string;
  };

export type MergePreview = {
  readonly consumedUnits: readonly [HeroUnit, HeroUnit, HeroUnit];
  readonly resultTier: HeroTier;
};

export type MergeUndo = {
  readonly consumedUnits: readonly [HeroUnit, HeroUnit, HeroUnit];
  readonly producedUnit: HeroUnit;
  readonly expiresAt: number;
};

export type TicketOption =
  | { readonly kind: "choice"; readonly heroClass: HeroClass }
  | { readonly kind: "challenge" };

export const TICKET_OFFER = Object.freeze({
  choiceTier: HERO_TIERS[4],
  challengeTier: HERO_TIERS[5],
  challengeSuccessChance: DEFENSE_RULES.ticketChallengeSuccessChance,
  challengeFailureReward: "none",
  requiresConfirmation: true,
} as const);

export function createHeroInventory(money: number = DEFENSE_RULES.startingMoney): HeroInventory {
  return Object.freeze({
    units: Object.freeze([]),
    economy: createEconomyState(money),
    tickets: 0,
    awardedTicketRounds: Object.freeze([]),
    nextUnitId: 1,
    drawState: Object.freeze({ lowTierStreak: 0, missingClassStreak: 0 }),
  });
}

export function createHeroUnit(
  id: HeroUnitId,
  heroClass: HeroClass,
  tier: HeroTier,
  stats: HeroUnit["stats"] = { attackBonus: 0, kills: 0 },
  equipment: HeroUnit["equipment"] = {},
): HeroUnit {
  return Object.freeze({ id, heroClass, tier, stats: Object.freeze({ ...stats }), equipment: Object.freeze({ ...equipment }) });
}

export function getAdjustedTierProbabilities(_lowTierStreak: number): ProbabilityTable<HeroTier> {
  if (!Number.isInteger(_lowTierStreak) || _lowTierStreak < 0) {
    throw new DefenseConfigError("Low-tier pity streak must be a non-negative integer");
  }
  const pitySteps = Math.max(0, _lowTierStreak - DEFENSE_RULES.lowTierPityStartsAfter + 1);
  const bonus = Math.min(DEFENSE_RULES.lowTierPityMaxBonus, pitySteps * DEFENSE_RULES.lowTierPityStep);
  const higherTierBase = 100 - GACHA_WEIGHTS.common;
  const higherTierScale = (higherTierBase + bonus) / higherTierBase;
  return Object.freeze({
    common: GACHA_WEIGHTS.common - bonus,
    rare: GACHA_WEIGHTS.rare * higherTierScale,
    epic: GACHA_WEIGHTS.epic * higherTierScale,
    legendary: GACHA_WEIGHTS.legendary * higherTierScale,
    mythic: GACHA_WEIGHTS.mythic * higherTierScale,
    primordial: GACHA_WEIGHTS.primordial * higherTierScale,
  });
}

export function rollHero(
  random: RandomSource,
  drawState: HeroInventory["drawState"],
  ownedClasses: readonly HeroClass[],
): HeroRoll {
  const owned = new Set(ownedClasses);
  const missingClasses = HERO_CLASSES.filter((heroClass) => !owned.has(heroClass));
  const guaranteedMissingClass = missingClasses.length > 0
    && drawState.missingClassStreak >= DEFENSE_RULES.missingClassGuaranteeDraws - 1;
  const heroClass = guaranteedMissingClass
    ? pickEqual(missingClasses, random)
    : weightedPick(HERO_CLASSES, CLASS_WEIGHTS, random);
  const probabilities = getAdjustedTierProbabilities(drawState.lowTierStreak);
  const tier = weightedPick(HERO_TIERS, probabilities, random);
  owned.add(heroClass);
  return Object.freeze({
    heroClass,
    tier,
    probabilities,
    guaranteedMissingClass,
    drawState: Object.freeze({
      lowTierStreak: tier === "common" ? drawState.lowTierStreak + 1 : 0,
      missingClassStreak: owned.size === HERO_CLASSES.length || guaranteedMissingClass
        ? 0
        : drawState.missingClassStreak + 1,
    }),
  });
}

export function drawHero(
  state: HeroInventory,
  random: RandomSource,
  capacity: number = DEFENSE_RULES.heroInventoryCapacity,
): HeroActionFailure | { readonly ok: true; readonly state: HeroInventory; readonly unit: HeroUnit; readonly roll: HeroRoll } {
  validateCapacity(capacity);
  const payment = spendSharedMoney(state.economy, DEFENSE_RULES.drawCost);
  if (payment.kind === "insufficient-funds") return failure(state, "insufficient-currency");
  if (state.units.length >= capacity) return failure(state, "inventory-full");
  const roll = rollHero(random, state.drawState, state.units.map((unit) => unit.heroClass));
  const unit = createHeroUnit(nextHeroUnitId(state), roll.heroClass, roll.tier);
  return Object.freeze({
    ok: true,
    unit,
    roll,
    state: updateInventory(state, {
      units: [...state.units, unit],
      economy: payment.state,
      nextUnitId: state.nextUnitId + 1,
      drawState: roll.drawState,
    }),
  });
}

export function awardRoundTicket(state: HeroInventory, round: number): HeroInventory {
  if (!Number.isInteger(round) || round < 1 || round > DEFENSE_RULES.totalRounds) {
    throw new DefenseConfigError(`Ticket round must be between 1 and ${DEFENSE_RULES.totalRounds}`);
  }
  if (
    round % DEFENSE_RULES.ticketEveryRounds !== 0
    || state.awardedTicketRounds.includes(round)
  ) {
    return state;
  }
  return updateInventory(state, {
    tickets: state.tickets + 1,
    awardedTicketRounds: [...state.awardedTicketRounds, round],
  });
}

export function redeemTicket(
  state: HeroInventory,
  option: TicketOption,
  confirmed: boolean,
  random: RandomSource,
  capacity: number = DEFENSE_RULES.heroInventoryCapacity,
): HeroActionFailure | { readonly ok: true; readonly state: HeroInventory; readonly unit: HeroUnit | null } {
  validateCapacity(capacity);
  if (state.tickets < 1) return failure(state, "no-ticket");
  if (!confirmed) return failure(state, "confirmation-required");
  if (state.units.length >= capacity) return failure(state, "inventory-full");

  let unit: HeroUnit | null = null;
  switch (option.kind) {
    case "choice":
      unit = createHeroUnit(nextHeroUnitId(state), option.heroClass, TICKET_OFFER.choiceTier);
      break;
    case "challenge":
      if (random() < TICKET_OFFER.challengeSuccessChance) {
        unit = createHeroUnit(
          nextHeroUnitId(state),
          weightedPick(HERO_CLASSES, CLASS_WEIGHTS, random),
          TICKET_OFFER.challengeTier,
        );
      }
      break;
  }
  return Object.freeze({
    ok: true,
    unit,
    state: updateInventory(state, {
      units: unit === null ? state.units : [...state.units, unit],
      tickets: state.tickets - 1,
      nextUnitId: state.nextUnitId + (unit === null ? 0 : 1),
    }),
  });
}

export function previewMerge(
  state: HeroInventory,
  unitIds: readonly HeroUnitId[],
): HeroActionFailure | { readonly ok: true; readonly preview: MergePreview } {
  if (unitIds.length !== DEFENSE_RULES.mergeCount || new Set(unitIds).size !== DEFENSE_RULES.mergeCount) {
    return failure(state, "ineligible-merge");
  }
  const units = unitIds.map((id) => state.units.find((unit) => unit.id === id));
  if (units.some((unit) => unit === undefined)) return failure(state, "missing-unit");
  const first = units[0];
  const second = units[1];
  const third = units[2];
  if (first === undefined || second === undefined || third === undefined) return failure(state, "missing-unit");
  const tierIndex = HERO_TIERS.indexOf(first.tier);
  if (tierIndex < 0 || tierIndex >= HERO_TIERS.length - 1 || units.some((unit) => unit?.tier !== first.tier)) {
    return failure(state, "ineligible-merge");
  }
  const resultTier = HERO_TIERS[tierIndex + 1];
  if (resultTier === undefined) return failure(state, "ineligible-merge");
  const consumedUnits: readonly [HeroUnit, HeroUnit, HeroUnit] = [first, second, third];
  return Object.freeze({
    ok: true,
    preview: Object.freeze({ consumedUnits: Object.freeze(consumedUnits), resultTier }),
  });
}

export function confirmMerge(
  state: HeroInventory,
  preview: MergePreview,
  now: number,
  random: RandomSource,
): HeroActionFailure | { readonly ok: true; readonly state: HeroInventory; readonly unit: HeroUnit; readonly undo: MergeUndo } {
  if (!Number.isFinite(now)) throw new DefenseConfigError("Merge time must be finite");
  const current = previewMerge(state, preview.consumedUnits.map((source) => source.id));
  if (
    !current.ok
    || current.preview.resultTier !== preview.resultTier
    || current.preview.consumedUnits.some((unit, index) => !sameUnit(unit, preview.consumedUnits[index]))
  ) {
    return failure(state, "stale-preview");
  }
  const unit = createHeroUnit(
    nextHeroUnitId(state),
    weightedPick(HERO_CLASSES, CLASS_WEIGHTS, random),
    preview.resultTier,
  );
  const consumedIds = new Set(preview.consumedUnits.map((source) => source.id));
  const nextState = updateInventory(state, {
    units: [...state.units.filter((candidate) => !consumedIds.has(candidate.id)), unit],
    nextUnitId: state.nextUnitId + 1,
  });
  return Object.freeze({
    ok: true,
    state: nextState,
    unit,
    undo: Object.freeze({
      consumedUnits: preview.consumedUnits,
      producedUnit: unit,
      expiresAt: now + DEFENSE_RULES.mergeUndoMs,
    }),
  });
}

export function undoMerge(
  state: HeroInventory,
  undo: MergeUndo,
  now: number,
): HeroActionFailure | { readonly ok: true; readonly state: HeroInventory } {
  if (!Number.isFinite(now)) throw new DefenseConfigError("Undo time must be finite");
  if (!Number.isFinite(undo.expiresAt) || !isValidUndoSnapshot(undo)) return failure(state, "stale-undo");
  if (now > undo.expiresAt) return failure(state, "expired-undo");
  const produced = state.units.find((unit) => unit.id === undo.producedUnit.id);
  const consumedIds = new Set(undo.consumedUnits.map((unit) => unit.id));
  if (
    produced === undefined
    || !sameUnit(produced, undo.producedUnit)
    || state.units.some((unit) => consumedIds.has(unit.id))
  ) {
    return failure(state, "stale-undo");
  }
  return Object.freeze({
    ok: true,
    state: updateInventory(state, {
      units: [...state.units.filter((unit) => unit.id !== undo.producedUnit.id), ...undo.consumedUnits],
    }),
  });
}

export function convertTopTier(
  state: HeroInventory,
  unitId: HeroUnitId,
  random: RandomSource,
): HeroActionFailure | { readonly ok: true; readonly state: HeroInventory; readonly unit: HeroUnit } {
  const source = state.units.find((unit) => unit.id === unitId);
  if (source === undefined) return failure(state, "missing-unit");
  if (source.tier !== HERO_TIERS[HERO_TIERS.length - 1]) return failure(state, "not-top-tier");
  const payment = spendSharedMoney(state.economy, DEFENSE_RULES.topTierConversionCost);
  if (payment.kind === "insufficient-funds") return failure(state, "insufficient-currency");
  const otherClasses = HERO_CLASSES.filter((heroClass) => heroClass !== source.heroClass);
  const unit = createHeroUnit(source.id, pickEqual(otherClasses, random), source.tier, source.stats, source.equipment);
  return Object.freeze({
    ok: true,
    unit,
    state: updateInventory(state, {
      units: state.units.map((candidate) => candidate.id === unitId ? unit : candidate),
      economy: payment.state,
    }),
  });
}

export function purchaseHeroUpgrade(state: HeroInventory, target: UpgradeTarget): HeroUpgradePurchaseResult {
  const result = purchaseUpgrade(state.economy, target);
  switch (result.kind) {
    case "purchased":
      return Object.freeze({ kind: "purchased", target: result.target, state: updateInventory(state, { economy: result.state }) });
    case "max-level":
      return Object.freeze({ kind: "max-level", state, message: result.message });
    case "insufficient-funds":
      return Object.freeze({
        kind: "insufficient-funds",
        state,
        currentMoney: result.currentMoney,
        cost: result.cost,
        missingMoney: result.missingMoney,
        message: result.message,
      });
  }
}

export function calculateHeroUnitDamage(unit: HeroUnit, economy: EconomyState): number {
  return calculateAttackDamage({
    heroClass: unit.heroClass,
    tier: unit.tier,
    classUpgradeLevel: economy.classUpgradeLevels[unit.heroClass],
    tierUpgradeLevel: economy.tierUpgradeLevels[unit.tier],
    equipmentAttackBonus: unit.stats.attackBonus,
  });
}

function failure(state: HeroInventory, reason: HeroActionFailureReason): HeroActionFailure {
  return Object.freeze({ ok: false, reason, state });
}

function validateCapacity(capacity: number): void {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new DefenseConfigError("Hero inventory capacity must be a positive integer");
  }
}

function pickEqual<const Value extends string>(values: readonly Value[], random: RandomSource): Value {
  const value = values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  if (value === undefined) throw new DefenseConfigError("Cannot pick from an empty list");
  return value;
}

function nextHeroUnitId(state: HeroInventory): HeroUnitId {
  return `hero-${state.nextUnitId}`;
}

function updateInventory(
  state: HeroInventory,
  changes: Partial<Omit<HeroInventory, "units" | "awardedTicketRounds">> & {
    readonly units?: readonly HeroUnit[];
    readonly awardedTicketRounds?: readonly number[];
  },
): HeroInventory {
  return Object.freeze({
    ...state,
    ...changes,
    units: Object.freeze([...(changes.units ?? state.units)]),
    awardedTicketRounds: Object.freeze([...(changes.awardedTicketRounds ?? state.awardedTicketRounds)]),
  });
}

function sameUnit(left: HeroUnit, right: HeroUnit | undefined): boolean {
  return right !== undefined
    && left.id === right.id
    && left.heroClass === right.heroClass
    && left.tier === right.tier
    && left.stats.attackBonus === right.stats.attackBonus
    && left.stats.kills === right.stats.kills
    && EQUIPMENT_SLOTS.every((slot) => left.equipment[slot] === right.equipment[slot]);
}

function isValidUndoSnapshot(undo: MergeUndo): boolean {
  const [first, second, third] = undo.consumedUnits;
  const consumedIds = new Set(undo.consumedUnits.map((unit) => unit.id));
  const sourceTierIndex = HERO_TIERS.indexOf(first.tier);
  return consumedIds.size === DEFENSE_RULES.mergeCount
    && !consumedIds.has(undo.producedUnit.id)
    && second.tier === first.tier
    && third.tier === first.tier
    && HERO_TIERS[sourceTierIndex + 1] === undo.producedUnit.tier;
}
