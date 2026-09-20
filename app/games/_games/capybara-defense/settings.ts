import type { DefenseStorage } from "./persistence";

export const DEFENSE_SETTINGS_KEY = "capybara-defense.settings";

export type DefenseSettings = Readonly<{
  bgm: boolean;
  sfx: boolean;
  damageNumbers: boolean;
  screenShake: boolean;
}>;

export const DEFAULT_DEFENSE_SETTINGS: DefenseSettings = Object.freeze({
  bgm: true,
  sfx: true,
  damageNumbers: true,
  screenShake: true,
});

export function parseDefenseSettings(raw: string | null): DefenseSettings {
  if (raw === null) return DEFAULT_DEFENSE_SETTINGS;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) return DEFAULT_DEFENSE_SETTINGS;
    throw error;
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 4 ||
    !("bgm" in value) ||
    !("sfx" in value) ||
    !("damageNumbers" in value) ||
    !("screenShake" in value) ||
    typeof value.bgm !== "boolean" ||
    typeof value.sfx !== "boolean" ||
    typeof value.damageNumbers !== "boolean" ||
    typeof value.screenShake !== "boolean"
  ) {
    return DEFAULT_DEFENSE_SETTINGS;
  }
  return Object.freeze({
    bgm: value.bgm,
    sfx: value.sfx,
    damageNumbers: value.damageNumbers,
    screenShake: value.screenShake,
  });
}

export function readDefenseSettings(storage: DefenseStorage): DefenseSettings {
  return parseDefenseSettings(storage.getItem(DEFENSE_SETTINGS_KEY));
}

export function writeDefenseSettings(storage: DefenseStorage, settings: DefenseSettings): void {
  storage.setItem(DEFENSE_SETTINGS_KEY, JSON.stringify(settings));
}
