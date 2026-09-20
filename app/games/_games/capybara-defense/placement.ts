import { HERO_STATS, HERO_TIERS } from "./constants";
import {
  confirmMerge,
  previewMerge,
  undoMerge,
} from "./heroes";
import type { MergePreview, MergeUndo } from "./heroes";
import type {
  ClockSpeed,
  HeroInventory,
  HeroUnitId,
  MapId,
  MapPoint,
  RandomSource,
  TargetPriority,
} from "./types";
import { DefenseConfigError } from "./types";

export const SELL_REFUND_RATE = 0.5; export const SKILL_TARGET_SPEED = 0.25;
const PLACEMENT_SNAPSHOT: unique symbol = Symbol("placement-snapshot");
export type PlacementZone = Readonly<{
  id: string;
  kind: "slot" | "path";
  position: MapPoint;
}>;
export type ManagedUnit = Readonly<{
  unitId: HeroUnitId;
  slotId: string | null;
  priority: TargetPriority;
  range: number;
  investedCost: number;
}>;
export type PlacementState = Readonly<{
  mapId: MapId;
  money: number;
  units: readonly ManagedUnit[];
}>;

export type PlacementReason = "missing-unit" | "occupied" | "outside" | "path";
export type PlacementPreview = Readonly<{
  unitId: HeroUnitId;
  targetId: string | null;
  valid: boolean;
  reason: PlacementReason | null;
  message: string;
  position: MapPoint | null;
  range: number;
}>;

export type PlaybackState = Readonly<{
  selectedSpeed: ClockSpeed;
  effectiveSpeed: ClockSpeed | typeof SKILL_TARGET_SPEED;
  phaseElapsedMs: number;
  skillTargeting: boolean;
}>;

export type PlacementMergePreview = Readonly<{
  merge: MergePreview;
  disappearing: readonly ManagedUnit[];
}>;

export type PlacementMergeUndo = Readonly<{
  merge: MergeUndo;
  consumed: readonly ManagedUnit[];
  produced: ManagedUnit;
  [PLACEMENT_SNAPSHOT]: string;
}>;

const zones = (mapId: MapId, slotPoints: readonly MapPoint[], pathPoints: readonly MapPoint[]): readonly PlacementZone[] =>
  Object.freeze([
    ...slotPoints.map((position, index) => Object.freeze({ id: `${mapId}-slot-${index + 1}`, kind: "slot" as const, position: Object.freeze({ ...position }) })),
    ...pathPoints.map((position, index) => Object.freeze({ id: `${mapId}-path-${index + 1}`, kind: "path" as const, position: Object.freeze({ ...position }) })),
  ]);

export const PLACEMENT_ZONES = Object.freeze({
  "reed-marsh": zones("reed-marsh", [
    { x: 180, y: 155 }, { x: 285, y: 155 }, { x: 180, y: 285 }, { x: 285, y: 285 },
    { x: 120, y: 225 }, { x: 340, y: 225 },
  ], [{ x: 220, y: 80 }, { x: 375, y: 220 }, { x: 220, y: 375 }, { x: 80, y: 220 }]),
  "hot-spring": zones("hot-spring", [
    { x: 185, y: 160 }, { x: 300, y: 160 }, { x: 185, y: 300 }, { x: 300, y: 300 },
    { x: 125, y: 230 }, { x: 365, y: 230 },
  ], [{ x: 240, y: 80 }, { x: 410, y: 230 }, { x: 240, y: 380 }, { x: 80, y: 230 }]),
  "moonlit-orchard": zones("moonlit-orchard", [
    { x: 190, y: 165 }, { x: 315, y: 165 }, { x: 190, y: 315 }, { x: 315, y: 315 },
    { x: 125, y: 240 }, { x: 385, y: 240 },
  ], [{ x: 250, y: 80 }, { x: 430, y: 240 }, { x: 250, y: 400 }, { x: 80, y: 240 }]),
} satisfies Readonly<Record<MapId, readonly PlacementZone[]>>);

const freezeState = (mapId: MapId, units: readonly ManagedUnit[], money: number): PlacementState =>
  Object.freeze({ mapId, money, units: Object.freeze(units.map((unit) => Object.freeze({ ...unit }))) });

const isTargetPriority = (priority: string): priority is TargetPriority =>
  priority === "first" || priority === "last" || priority === "strongest" || priority === "nearest";

export function createPlacementState(mapId: MapId, units: readonly ManagedUnit[], money = 0): PlacementState {
  if (!Object.hasOwn(PLACEMENT_ZONES, mapId)) throw new DefenseConfigError("Unknown placement map");
  if (!Number.isSafeInteger(money) || money < 0) throw new DefenseConfigError("Placement money must be a non-negative safe integer");
  const ids = new Set<HeroUnitId>();
  const occupied = new Set<string>();
  for (const unit of units) {
    if (ids.has(unit.unitId)) throw new DefenseConfigError("Placement unit IDs must be unique");
    if (!isTargetPriority(unit.priority) || !Number.isFinite(unit.range) || unit.range <= 0
      || !Number.isSafeInteger(unit.investedCost) || unit.investedCost < 0) {
      throw new DefenseConfigError("Placement range and invested cost must be valid");
    }
    ids.add(unit.unitId);
    if (unit.slotId === null) continue;
    const zone = PLACEMENT_ZONES[mapId].find((candidate) => candidate.id === unit.slotId);
    if (zone?.kind !== "slot" || occupied.has(unit.slotId)) throw new DefenseConfigError("Placed units require unique buildable slots");
    occupied.add(unit.slotId);
  }
  return freezeState(mapId, units, money);
}

function rejected(unitId: HeroUnitId, targetId: string | null, reason: PlacementReason, range: number, position: MapPoint | null): PlacementPreview {
  const messages: Readonly<Record<PlacementReason, string>> = {
    "missing-unit": "배치할 유닛을 찾지 못했어요.", occupied: "이미 다른 유닛이 있는 자리예요.",
    outside: "배치 구역 밖이에요.", path: "몬스터 길 위에는 배치할 수 없어요.",
  };
  return Object.freeze({ unitId, targetId, valid: false, reason, message: messages[reason], position, range });
}

export function previewPlacement(state: PlacementState, unitId: HeroUnitId, targetId: string | null): PlacementPreview {
  const unit = state.units.find((candidate) => candidate.unitId === unitId);
  if (unit === undefined) return rejected(unitId, targetId, "missing-unit", 0, null);
  const zone = PLACEMENT_ZONES[state.mapId].find((candidate) => candidate.id === targetId);
  if (zone === undefined) return rejected(unitId, targetId, "outside", unit.range, null);
  if (zone.kind === "path") return rejected(unitId, targetId, "path", unit.range, zone.position);
  const occupant = state.units.find((candidate) => candidate.slotId === targetId && candidate.unitId !== unitId);
  if (occupant !== undefined) return rejected(unitId, targetId, "occupied", unit.range, zone.position);
  return Object.freeze({ unitId, targetId, valid: true, reason: null, message: "여기에 배치할 수 있어요.", position: zone.position, range: unit.range });
}

export function confirmPlacement(state: PlacementState, preview: PlacementPreview) {
  const current = previewPlacement(state, preview.unitId, preview.targetId);
  if (!current.valid || !preview.valid || preview.targetId === null) return Object.freeze({ ok: false as const, state, preview: current });
  const units = state.units.map((unit) => unit.unitId === preview.unitId ? Object.freeze({ ...unit, slotId: preview.targetId }) : unit);
  return Object.freeze({ ok: true as const, state: freezeState(state.mapId, units, state.money) });
}

export function sellPlacedUnit(state: PlacementState, unitId: HeroUnitId) {
  const unit = state.units.find((candidate) => candidate.unitId === unitId);
  if (unit === undefined) return Object.freeze({ ok: false as const, reason: "missing-unit" as const, state });
  const refund = Math.floor(unit.investedCost * SELL_REFUND_RATE);
  if (!Number.isSafeInteger(state.money + refund)) {
    return Object.freeze({ ok: false as const, reason: "money-overflow" as const, state });
  }
  return Object.freeze({
    ok: true as const, refund,
    state: freezeState(state.mapId, state.units.filter((candidate) => candidate.unitId !== unitId), state.money + refund),
  });
}

export function changeTargetPriority(state: PlacementState, unitId: HeroUnitId, priority: string) {
  if (!isTargetPriority(priority)) return Object.freeze({ ok: false as const, reason: "invalid-priority" as const, state });
  if (!state.units.some((unit) => unit.unitId === unitId)) {
    return Object.freeze({ ok: false as const, reason: "missing-unit" as const, state });
  }
  const units = state.units.map((unit) => unit.unitId === unitId ? Object.freeze({ ...unit, priority }) : unit);
  return Object.freeze({ ok: true as const, state: freezeState(state.mapId, units, state.money) });
}

export function createPlaybackState(phaseElapsedMs = 0): PlaybackState {
  if (!Number.isFinite(phaseElapsedMs) || phaseElapsedMs < 0) throw new DefenseConfigError("Phase elapsed time must be finite and non-negative");
  return Object.freeze({ selectedSpeed: 1, effectiveSpeed: 1, phaseElapsedMs, skillTargeting: false });
}

export function setPlaybackSpeed(state: PlaybackState, speed: number): PlaybackState {
  if (speed !== 1 && speed !== 2) throw new DefenseConfigError("Playback speed must be 1 or 2");
  return Object.freeze({ ...state, selectedSpeed: speed, effectiveSpeed: state.skillTargeting ? SKILL_TARGET_SPEED : speed });
}

export const beginSkillTargeting = (state: PlaybackState): PlaybackState =>
  Object.freeze({ ...state, skillTargeting: true, effectiveSpeed: SKILL_TARGET_SPEED });

export const endSkillTargeting = (state: PlaybackState): PlaybackState =>
  Object.freeze({ ...state, skillTargeting: false, effectiveSpeed: state.selectedSpeed });

const sameManagedUnit = (left: ManagedUnit, right: ManagedUnit): boolean =>
  left.unitId === right.unitId && left.slotId === right.slotId && left.priority === right.priority
  && left.range === right.range && left.investedCost === right.investedCost;

const isManagedUnit = (unit: ManagedUnit | undefined): unit is ManagedUnit => unit !== undefined;

const placementSnapshotKey = (consumed: readonly ManagedUnit[], produced: ManagedUnit): string =>
  [...consumed, produced]
    .map((unit) => `${unit.unitId}|${unit.slotId ?? ""}|${unit.priority}|${unit.range}|${unit.investedCost}`)
    .join(";");

export function previewPlacementMerge(state: PlacementState, inventory: HeroInventory, unitIds: readonly HeroUnitId[]) {
  const merge = previewMerge(inventory, unitIds);
  if (!merge.ok) return Object.freeze({ ok: false as const, reason: merge.reason, placement: state, inventory });
  const candidates = merge.preview.consumedUnits.map((hero) => state.units.find((unit) => unit.unitId === hero.id));
  if (!candidates.every(isManagedUnit)) {
    return Object.freeze({ ok: false as const, reason: "missing-unit" as const, placement: state, inventory });
  }
  const disappearing = Object.freeze(candidates.filter(isManagedUnit));
  return Object.freeze({ ok: true as const, preview: Object.freeze({ merge: merge.preview, disappearing: Object.freeze(disappearing) }) });
}

export function confirmPlacementMerge(state: PlacementState, inventory: HeroInventory, preview: PlacementMergePreview, now: number, random: RandomSource) {
  const current = previewPlacementMerge(state, inventory, preview.merge.consumedUnits.map((unit) => unit.id));
  if (!current.ok || preview.disappearing.length !== current.preview.disappearing.length
    || current.preview.disappearing.some((unit, index) => {
      const expected = preview.disappearing[index];
      return expected === undefined || !sameManagedUnit(unit, expected);
    })) {
    return Object.freeze({ ok: false as const, reason: "stale-preview" as const, placement: state, inventory });
  }
  const merged = confirmMerge(inventory, preview.merge, now, random);
  if (!merged.ok) return Object.freeze({ ok: false as const, reason: merged.reason, placement: state, inventory });
  const tierIndex = HERO_TIERS.indexOf(merged.unit.tier);
  const first = current.preview.disappearing[0];
  if (first === undefined) return Object.freeze({ ok: false as const, reason: "stale-preview" as const, placement: state, inventory });
  const produced = Object.freeze({
    unitId: merged.unit.id, slotId: first.slotId, priority: first.priority,
    range: HERO_STATS[merged.unit.heroClass].range[tierIndex] ?? first.range,
    investedCost: current.preview.disappearing.reduce((sum, unit) => sum + unit.investedCost, 0),
  });
  const consumedIds = new Set(current.preview.disappearing.map((unit) => unit.unitId));
  const placement = freezeState(state.mapId, [...state.units.filter((unit) => !consumedIds.has(unit.unitId)), produced], state.money);
  return Object.freeze({
    ok: true as const, placement, inventory: merged.state,
    undo: Object.freeze({
      merge: merged.undo, consumed: current.preview.disappearing, produced,
      [PLACEMENT_SNAPSHOT]: placementSnapshotKey(current.preview.disappearing, produced),
    }),
  });
}

export function undoPlacementMerge(state: PlacementState, inventory: HeroInventory, undo: PlacementMergeUndo, now: number) {
  const produced = state.units.find((unit) => unit.unitId === undo.produced.unitId);
  const snapshotValid = undo.produced.unitId === undo.merge.producedUnit.id
    && undo.consumed.length === undo.merge.consumedUnits.length
    && undo.consumed.every((unit, index) => unit.unitId === undo.merge.consumedUnits[index]?.id)
    && new Set(undo.consumed.map((unit) => unit.unitId)).size === undo.consumed.length
    && new Set(undo.consumed.flatMap((unit) => unit.slotId ?? [])).size
      === undo.consumed.filter((unit) => unit.slotId !== null).length
    && undo[PLACEMENT_SNAPSHOT] === placementSnapshotKey(undo.consumed, undo.produced);
  const blocked = undo.consumed.some((unit) => unit.slotId !== null
    && state.units.some((candidate) => candidate.unitId !== undo.produced.unitId && candidate.slotId === unit.slotId));
  if (!snapshotValid || produced === undefined || !sameManagedUnit(produced, undo.produced) || blocked) {
    return Object.freeze({ ok: false as const, reason: "stale-placement-undo" as const, placement: state, inventory });
  }
  const restored = undoMerge(inventory, undo.merge, now);
  if (!restored.ok) return Object.freeze({ ok: false as const, reason: restored.reason, placement: state, inventory });
  const units = [...state.units.filter((unit) => unit.unitId !== undo.produced.unitId), ...undo.consumed];
  return Object.freeze({ ok: true as const, placement: freezeState(state.mapId, units, state.money), inventory: restored.state });
}
