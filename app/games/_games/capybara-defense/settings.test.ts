import { describe, expect, it } from "vitest";
import type { DefenseStorage } from "./persistence";
import {
  DEFAULT_DEFENSE_SETTINGS,
  parseDefenseSettings,
  readDefenseSettings,
  writeDefenseSettings,
} from "./settings";

function storage(): DefenseStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe("디펜스 설정", () => {
  it("BGM·효과음·피해 숫자·화면 흔들림을 서로 독립적으로 복원한다", () => {
    // Given
    const raw = JSON.stringify({ bgm: false, sfx: true, damageNumbers: false, screenShake: true });

    // When
    const settings = parseDefenseSettings(raw);

    // Then
    expect(settings).toEqual({ bgm: false, sfx: true, damageNumbers: false, screenShake: true });
  });

  it("불완전하거나 손상된 설정은 전체 기본값으로 복구한다", () => {
    // Given
    const values = [null, "{broken", JSON.stringify({ bgm: false })];

    // When
    const settings = values.map(parseDefenseSettings);

    // Then
    expect(settings).toEqual([
      DEFAULT_DEFENSE_SETTINGS,
      DEFAULT_DEFENSE_SETTINGS,
      DEFAULT_DEFENSE_SETTINGS,
    ]);
  });

  it("네 설정을 저장소에 함께 보존한다", () => {
    // Given
    const adapter = storage();
    const expected = { bgm: true, sfx: false, damageNumbers: true, screenShake: false };

    // When
    writeDefenseSettings(adapter, expected);
    const restored = readDefenseSettings(adapter);

    // Then
    expect(restored).toEqual(expected);
  });
});
