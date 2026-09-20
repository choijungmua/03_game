import { describe, expect, it } from "vitest";
import { DEFENSE_RULES } from "./constants";
import { createEconomyState } from "./economy";
import { createHeroUnit } from "./heroes";
import {
  PLACEMENT_ZONES,
  SELL_REFUND_RATE,
  beginSkillTargeting,
  changeTargetPriority,
  confirmPlacement,
  confirmPlacementMerge,
  createPlacementState,
  createPlaybackState,
  endSkillTargeting,
  previewPlacement,
  previewPlacementMerge,
  sellPlacedUnit,
  setPlaybackSpeed,
  undoPlacementMerge,
} from "./placement";
import type { HeroInventory, HeroUnit, MapId } from "./types";

function inventory(units: readonly HeroUnit[], nextUnitId = units.length + 1): HeroInventory {
  return Object.freeze({
    units: Object.freeze([...units]),
    economy: createEconomyState(0),
    tickets: 0,
    awardedTicketRounds: Object.freeze([]),
    nextUnitId,
    drawState: Object.freeze({ lowTierStreak: 0, missingClassStreak: 0 }),
  });
}

const MAP_IDS = ["reed-marsh", "hot-spring", "moonlit-orchard"] as const satisfies readonly MapId[];

describe("카피바라 디펜스 배치 계약", () => {
  it("Given 각 맵의 유한 구역 When 같은 순수 검증을 호출하면 Then 모든 슬롯·길·외부 경계를 구분한다", () => {
    for (const mapId of MAP_IDS) {
      const unit = { unitId: "hero-1" as const, slotId: null, priority: "first" as const, range: 123, investedCost: 9 };
      const state = createPlacementState(mapId, [unit]);

      for (const zone of PLACEMENT_ZONES[mapId]) {
        const preview = previewPlacement(state, "hero-1", zone.id);
        expect(preview.valid).toBe(zone.kind === "slot");
        expect(preview.reason).toBe(zone.kind === "slot" ? null : "path");
        expect(preview.range).toBe(123);
        if (zone.kind === "slot") {
          const occupied = createPlacementState(mapId, [
            unit,
            { unitId: "hero-2", slotId: zone.id, priority: "last", range: 90, investedCost: 3 },
          ]);
          expect(previewPlacement(occupied, "hero-1", zone.id).reason).toBe("occupied");
        }
      }
      const outside = previewPlacement(state, "hero-1", `${mapId}-outside`);
      const pointerOutside = previewPlacement(state, "hero-1", null);
      expect(outside).toMatchObject({ valid: false, reason: "outside", message: "배치 구역 밖이에요." });
      expect(pointerOutside).toMatchObject({ valid: false, reason: "outside", targetId: null });
    }
  });
  it("Given 점유 슬롯과 조작된 미리보기 When 확정하면 Then 돈·유닛은 그대로이고 현재 사유를 반환한다", () => {
    const [slot, other] = PLACEMENT_ZONES["reed-marsh"].filter((zone) => zone.kind === "slot");
    expect(slot).toBeDefined();
    expect(other).toBeDefined();
    if (slot === undefined || other === undefined) return;
    const state = createPlacementState("reed-marsh", [
      { unitId: "hero-1", slotId: null, priority: "first", range: 110, investedCost: 6 },
      { unitId: "hero-2", slotId: slot.id, priority: "last", range: 90, investedCost: 3 },
    ], 17);

    const occupied = previewPlacement(state, "hero-1", slot.id);
    const misleading = { ...previewPlacement(state, "hero-1", other.id), targetId: slot.id };
    const rejected = confirmPlacement(state, occupied);
    const stale = confirmPlacement(state, misleading);

    expect(occupied).toMatchObject({ valid: false, reason: "occupied", message: "이미 다른 유닛이 있는 자리예요." });
    expect(rejected).toEqual({ ok: false, state, preview: occupied });
    expect(stale).toMatchObject({ ok: false, state, preview: { reason: "occupied" } });
  });
  it("Given 중복 ID·슬롯 또는 길 위 초기 상태 When 경계를 파싱하면 Then 잘못된 상태를 거부한다", () => {
    const slot = PLACEMENT_ZONES["reed-marsh"].find((zone) => zone.kind === "slot");
    const path = PLACEMENT_ZONES["reed-marsh"].find((zone) => zone.kind === "path");
    expect(slot).toBeDefined();
    expect(path).toBeDefined();
    if (slot === undefined || path === undefined) return;
    const base = { unitId: "hero-1" as const, slotId: slot.id, priority: "first" as const, range: 100, investedCost: 3 };
    expect(() => createPlacementState("reed-marsh", [base, base])).toThrow("Placement unit IDs must be unique");
    expect(() => createPlacementState("reed-marsh", [base, { ...base, unitId: "hero-2" }])).toThrow("unique buildable slots");
    expect(() => createPlacementState("reed-marsh", [{ ...base, slotId: path.id }])).toThrow("unique buildable slots");

    const mutable = { ...base, slotId: null };
    const snapshot = createPlacementState("reed-marsh", [mutable]);
    mutable.range = 0;
    expect(snapshot.units[0]?.range).toBe(100);
    expect(createPlacementState("reed-marsh", []).units).toEqual([]);
  });
  it("Given 배치 가능한 유닛 When 두 번 이동하면 Then 횟수 제한·비용 없이 위치와 미리보기만 갱신한다", () => {
    const slots = PLACEMENT_ZONES["hot-spring"].filter((zone) => zone.kind === "slot");
    const first = slots[0];
    const second = slots[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;
    const initial = createPlacementState("hot-spring", [
      { unitId: "hero-1", slotId: null, priority: "first", range: 140, investedCost: 11 },
    ], 21);

    const placed = confirmPlacement(initial, previewPlacement(initial, "hero-1", first.id));
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const moved = confirmPlacement(placed.state, previewPlacement(placed.state, "hero-1", second.id));

    expect(moved.ok && moved.state.units[0]?.slotId).toBe(second.id);
    expect(moved.ok && moved.state.money).toBe(21);
  });
  it("Given 투자비가 있는 유닛 When 두 번 판매하면 Then 50% 내림 환급은 정확히 한 번만 지급된다", () => {
    const state = createPlacementState("moonlit-orchard", [
      { unitId: "hero-1", slotId: null, priority: "nearest", range: 100, investedCost: 9 },
    ], 4);

    const sold = sellPlacedUnit(state, "hero-1");
    expect(SELL_REFUND_RATE).toBe(0.5);
    expect(sold).toMatchObject({ ok: true, refund: 4, state: { money: 8, units: [] } });
    if (!sold.ok) return;
    expect(sellPlacedUnit(sold.state, "hero-1")).toEqual({ ok: false, reason: "missing-unit", state: sold.state });
  });

  it("Given 유닛 When 네 우선순위를 바꾸면 Then 전투 선택 값만 정확히 바뀐다", () => {
    let state = createPlacementState("reed-marsh", [
      { unitId: "hero-1", slotId: null, priority: "first", range: 100, investedCost: 3 },
    ], 5);
    for (const priority of ["first", "last", "strongest", "nearest"] as const) {
      const changed = changeTargetPriority(state, "hero-1", priority);
      expect(changed.ok && changed.state.units[0]?.priority).toBe(priority);
      expect(changed.ok && changed.state.money).toBe(5);
      if (changed.ok) state = changed.state;
    }
    expect(changeTargetPriority(state, "hero-1", "invalid")).toEqual({ ok: false, reason: "invalid-priority", state });
  });

  it("Given 안전 정수 한계의 돈 When 판매 환급이 넘치면 Then 유닛과 돈을 그대로 유지한다", () => {
    const state = createPlacementState("reed-marsh", [
      { unitId: "hero-1", slotId: null, priority: "first", range: 100, investedCost: 3 },
    ], Number.MAX_SAFE_INTEGER);
    expect(sellPlacedUnit(state, "hero-1")).toEqual({ ok: false, reason: "money-overflow", state });
  });
});

describe("카피바라 디펜스 속도와 합성 되돌리기", () => {
  it("Given 2배속 전투 When 스킬 조준 중 선택 속도를 바꾸고 종료하면 Then 타이머는 보존되고 선택 속도로 복원된다", () => {
    const fast = setPlaybackSpeed(createPlaybackState(7_250), 2);
    const slowed = beginSkillTargeting(fast);
    const selectedNormal = setPlaybackSpeed(slowed, 1);
    const resumed = endSkillTargeting(selectedNormal);

    expect(fast).toMatchObject({ selectedSpeed: 2, effectiveSpeed: 2, phaseElapsedMs: 7_250 });
    expect(slowed).toMatchObject({ selectedSpeed: 2, effectiveSpeed: 0.25, phaseElapsedMs: 7_250 });
    expect(selectedNormal).toMatchObject({ selectedSpeed: 1, effectiveSpeed: 0.25, phaseElapsedMs: 7_250 });
    expect(resumed).toMatchObject({ selectedSpeed: 1, effectiveSpeed: 1, phaseElapsedMs: 7_250 });
    expect(() => setPlaybackSpeed(resumed, 3)).toThrow("Playback speed must be 1 or 2");
    expect(() => createPlaybackState(Number.NaN)).toThrow("Phase elapsed time must be finite and non-negative");
  });

  it("Given 서로 다른 배치의 같은 등급 세 유닛 When 합성 후 기한 안에 되돌리면 Then 영웅과 배치가 정확히 복원된다", () => {
    const heroes = [
      createHeroUnit("hero-1", "warrior", "common"),
      createHeroUnit("hero-2", "archer", "common"),
      createHeroUnit("hero-3", "mage", "common"),
    ] as const;
    const slots = PLACEMENT_ZONES["reed-marsh"].filter((zone) => zone.kind === "slot");
    const placements = heroes.map((hero, index) => ({
      unitId: hero.id,
      slotId: slots[index]?.id ?? null,
      priority: (["first", "last", "strongest"] as const)[index] ?? "nearest",
      range: 100 + index,
      investedCost: 3 + index,
    }));
    const placed = createPlacementState("reed-marsh", placements, 12);
    const roster = inventory(heroes, 4);

    const preview = previewPlacementMerge(placed, roster, ["hero-1", "hero-2", "hero-3"]);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const merged = confirmPlacementMerge(placed, roster, preview.preview, 1_000, () => 0);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    const restored = undoPlacementMerge(merged.placement, merged.inventory, merged.undo, 1_000 + DEFENSE_RULES.mergeUndoMs);

    expect(preview.preview.disappearing).toEqual(placements);
    expect(merged.placement.units).toHaveLength(1);
    expect(restored.ok && restored.placement.units).toEqual(placements);
    expect(restored.ok && restored.inventory.units).toEqual(heroes);
  });

  it("Given 만료·오염된 합성 상태 When 되돌리면 Then 부분 복구 없이 현재 상태를 유지한다", () => {
    const heroes = [
      createHeroUnit("hero-1", "warrior", "common"),
      createHeroUnit("hero-2", "archer", "common"),
      createHeroUnit("hero-3", "mage", "common"),
    ] as const;
    const placement = createPlacementState("reed-marsh", heroes.map((hero) => ({
      unitId: hero.id, slotId: null, priority: "first", range: 100, investedCost: 3,
    })));
    const roster = inventory(heroes, 4);
    const preview = previewPlacementMerge(placement, roster, heroes.map((hero) => hero.id));
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const misleadingPreview = { ...preview.preview, disappearing: preview.preview.disappearing.slice(1) };
    expect(confirmPlacementMerge(placement, roster, misleadingPreview, 0, () => 0))
      .toMatchObject({ ok: false, reason: "stale-preview", placement, inventory: roster });
    const merged = confirmPlacementMerge(placement, roster, preview.preview, 0, () => 0);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    const dirtyPlacement = { ...merged.placement, units: [] };
    const malformedUndo = { ...merged.undo, consumed: [merged.undo.consumed[0], merged.undo.consumed[0]] };
    const first = merged.undo.consumed[0];
    const second = merged.undo.consumed[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;
    const mutations = [
      { ...first, slotId: PLACEMENT_ZONES["reed-marsh"][0]?.id ?? null },
      { ...first, priority: "nearest" as const },
      { ...first, range: first.range + 1 },
      { ...first, investedCost: first.investedCost + 1 },
    ];

    expect(undoPlacementMerge(merged.placement, merged.inventory, merged.undo, DEFENSE_RULES.mergeUndoMs + 1))
      .toMatchObject({ ok: false, reason: "expired-undo" });
    expect(undoPlacementMerge(dirtyPlacement, merged.inventory, merged.undo, 1))
      .toEqual({ ok: false, reason: "stale-placement-undo", placement: dirtyPlacement, inventory: merged.inventory });
    expect(undoPlacementMerge(merged.placement, merged.inventory, malformedUndo, 1))
      .toMatchObject({ ok: false, reason: "stale-placement-undo" });
    for (const changed of mutations) {
      const forged = { ...merged.undo, consumed: [changed, ...merged.undo.consumed.slice(1)] };
      expect(undoPlacementMerge(merged.placement, merged.inventory, forged, 1))
        .toMatchObject({ ok: false, reason: "stale-placement-undo" });
    }
    const duplicateId = PLACEMENT_ZONES["reed-marsh"].find((zone) => zone.kind === "slot")?.id ?? "reed-marsh-slot-1";
    const duplicateSlot = {
      ...merged.undo,
      consumed: [{ ...first, slotId: duplicateId }, { ...second, slotId: duplicateId }, ...merged.undo.consumed.slice(2)],
    };
    expect(undoPlacementMerge(merged.placement, merged.inventory, duplicateSlot, 1))
      .toMatchObject({ ok: false, reason: "stale-placement-undo" });
  });
});
