import { describe, expect, it } from "vitest";
import { createEmptyInventory, createEmptyLoadout } from "./equipment";
import { createHeroInventory } from "./heroes";
import { createPlacementState } from "./placement";
import {
  DEFENSE_RECOVERY_KEY,
  DEFENSE_SAVE_KEY,
  clearDefenseSave,
  parseDefenseSave,
  readDefenseSave,
  serializeDefenseSave,
  shouldAutosaveRound,
  writeDefenseSave,
} from "./persistence";
import type { DefenseCheckpoint, DefenseStorage } from "./persistence";
import type { HeroInventory, MapId } from "./types";

function checkpoint(round: number, mapId: MapId): DefenseCheckpoint {
  const base = createHeroInventory(777);
  const heroInventory: HeroInventory = {
    ...base,
    units: [
      {
        id: "hero-1",
        heroClass: "archer",
        tier: "epic",
        stats: { attackBonus: 12, kills: 34 },
        equipment: { weapon: "equipment-reed-bow" },
      },
    ],
    tickets: 2,
    awardedTicketRounds: [15, 30],
    nextUnitId: 2,
    drawState: { lowTierStreak: 4, missingClassStreak: 1 },
    economy: {
      ...base.economy,
      money: 777,
      kills: 52,
      classUpgradeLevels: { warrior: 1, archer: 3, rogue: 2, mage: 0 },
      tierUpgradeLevels: {
        common: 1,
        rare: 2,
        epic: 3,
        legendary: 4,
        mythic: 5,
        primordial: 6,
      },
    },
  };
  const reedBow = {
    id: "equipment-reed-bow",
    slot: "weapon",
    rarity: "epic",
    requiredClass: "archer",
    source: "boss",
    effect: {
      attackBonus: 0.18,
      shieldBonus: 0,
      attackSpeedBonus: 0,
      rangeBonus: 0,
      manaBonus: 0,
      cooldownReduction: 0,
      skillEffectBonus: 0,
    },
  } as const;
  const mossArmor = {
    id: "equipment-moss-armor",
    slot: "armor",
    rarity: "rare",
    requiredClass: "warrior",
    source: "normal",
    effect: {
      attackBonus: 0,
      shieldBonus: 0.1,
      attackSpeedBonus: 0,
      rangeBonus: 0,
      manaBonus: 0,
      cooldownReduction: 0,
      skillEffectBonus: 0,
    },
  } as const;
  return {
    mapId,
    round,
    phase: "preparation",
    lives: 17,
    mana: 63,
    heroInventory,
    placement: createPlacementState(
      mapId,
      [
        {
          unitId: "hero-1",
          slotId: `${mapId}-slot-1`,
          priority: "strongest",
          range: 270,
          investedCost: 85,
        },
      ],
      777,
    ),
    equipment: {
      inventory: {
        ...createEmptyInventory(),
        items: [mossArmor],
        collectedIds: [reedBow.id, mossArmor.id],
      },
      loadout: { ...createEmptyLoadout(), weapon: reedBow },
    },
  };
}

function memoryStorage(): DefenseStorage & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe("디펜스 체크포인트 저장", () => {
  it.each([10, 20, 30, 40, 50, 60, 70, 80, 90])(
    "%i라운드의 안정 상태를 손실 없이 왕복한다",
    (round) => {
      // Given
      const maps: readonly MapId[] = ["reed-marsh", "hot-spring", "moonlit-orchard"];
      const expected = checkpoint(round, maps[(round / 10) % maps.length] ?? "reed-marsh");

      // When
      const result = parseDefenseSave(serializeDefenseSave(expected));

      // Then
      expect(result).toEqual({ kind: "resume", checkpoint: expected });
    },
  );

  it("10라운드 단위만 자동 저장 대상으로 고른다", () => {
    // Given
    const rounds = [9, 10, 11, 89, 90, 100];

    // When
    const decisions = rounds.map(shouldAutosaveRound);

    // Then
    expect(decisions).toEqual([false, true, false, false, true, false]);
  });

  it("투사체와 피해 숫자 같은 일시 효과를 저장하지 않는다", () => {
    // Given
    const stable = checkpoint(20, "reed-marsh");

    // When
    const raw = serializeDefenseSave(stable);

    // Then
    expect(raw).not.toContain("projectiles");
    expect(raw).not.toContain("damageNumbers");
    expect(raw).not.toContain("monsters");
  });

  it("손상된 저장을 복구 키로 옮기고 새 시작 상태로 되돌린다", () => {
    // Given
    const storage = memoryStorage();
    storage.setItem(DEFENSE_SAVE_KEY, "{broken");

    // When
    const result = readDefenseSave(storage);

    // Then
    expect(result).toEqual({ kind: "discarded", reason: "corrupt" });
    expect(storage.getItem(DEFENSE_SAVE_KEY)).toBeNull();
    expect(storage.getItem(DEFENSE_RECOVERY_KEY)).toBe("{broken");
  });

  it("알 수 없는 버전을 버리고 부분 상태를 복원하지 않는다", () => {
    // Given
    const storage = memoryStorage();
    storage.setItem(DEFENSE_SAVE_KEY, '{"version":999,"checkpoint":{}}');

    // When
    const result = readDefenseSave(storage);

    // Then
    expect(result).toEqual({ kind: "discarded", reason: "unsupported-version" });
    expect(storage.getItem(DEFENSE_SAVE_KEY)).toBeNull();
  });

  it("저장과 명시적 삭제을 어댑터 경계에서 처리한다", () => {
    // Given
    const storage = memoryStorage();
    const expected = checkpoint(30, "hot-spring");

    // When
    writeDefenseSave(storage, expected);
    const resumed = readDefenseSave(storage);
    clearDefenseSave(storage);

    // Then
    expect(resumed).toEqual({ kind: "resume", checkpoint: expected });
    expect(storage.getItem(DEFENSE_SAVE_KEY)).toBeNull();
  });

  it("활성 전투 프레임과 필수 필드가 빠진 저장을 거부한다", () => {
    // Given
    const raw = JSON.stringify({
      version: 1,
      checkpoint: { ...checkpoint(40, "moonlit-orchard"), phase: "combat" },
    });

    // When
    const result = parseDefenseSave(raw);

    // Then
    expect(result).toEqual({ kind: "discarded", reason: "invalid" });
  });

  it.each([
    ["stale round", { ...checkpoint(90, "reed-marsh"), round: 100 }],
    ["dirty money", { ...checkpoint(50, "hot-spring"), placement: { ...checkpoint(50, "hot-spring").placement, money: 1 } }],
    ["misleading extra field", { ...checkpoint(60, "moonlit-orchard"), projectiles: [{ id: 1 }] }],
  ])("%s 저장을 부분 복원 없이 버린다", (_name, unsafeCheckpoint) => {
    // Given
    const raw = JSON.stringify({ version: 1, checkpoint: unsafeCheckpoint });

    // When
    const result = parseDefenseSave(raw);

    // Then
    expect(result).toEqual({ kind: "discarded", reason: "invalid" });
  });

  it("수집·장착 상태에 없는 장비 참조를 거부한다", () => {
    // Given
    const saved = checkpoint(70, "reed-marsh");
    const raw = JSON.stringify({
      version: 1,
      checkpoint: {
        ...saved,
        heroInventory: {
          ...saved.heroInventory,
          units: saved.heroInventory.units.map((unit) => ({
            ...unit,
            equipment: { weapon: "equipment-missing" },
          })),
        },
      },
    });

    // When
    const result = parseDefenseSave(raw);

    // Then
    expect(result).toEqual({ kind: "discarded", reason: "invalid" });
  });
});
