import { parseDefenseCheckpoint } from "./persistence-schema";
import type { DefenseCheckpoint } from "./persistence-schema";

export type { DefenseCheckpoint } from "./persistence-schema";

export const DEFENSE_SAVE_KEY = "capybara-defense.save";
export const DEFENSE_RECOVERY_KEY = "capybara-defense.save.recovery";

export type DefenseStorage = Readonly<{
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}>;

export type DefenseSaveReadResult =
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "resume"; checkpoint: DefenseCheckpoint }>
  | Readonly<{ kind: "discarded"; reason: "corrupt" | "unsupported-version" | "invalid" }>;

export function shouldAutosaveRound(round: number): boolean {
  return Number.isInteger(round) && round >= 10 && round <= 90 && round % 10 === 0;
}

export function serializeDefenseSave(checkpoint: DefenseCheckpoint): string {
  const parsed = parseDefenseCheckpoint(checkpoint);
  if (parsed === null) throw new TypeError("Defense checkpoint is invalid");
  return JSON.stringify({ version: 1, checkpoint: parsed });
}

export function parseDefenseSave(raw: string | null): DefenseSaveReadResult {
  if (raw === null) return Object.freeze({ kind: "empty" });
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) return Object.freeze({ kind: "discarded", reason: "corrupt" });
    throw error;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value) || !("version" in value)) {
    return Object.freeze({ kind: "discarded", reason: "invalid" });
  }
  if (value.version !== 1) return Object.freeze({ kind: "discarded", reason: "unsupported-version" });
  if (!("checkpoint" in value) || Object.keys(value).length !== 2) {
    return Object.freeze({ kind: "discarded", reason: "invalid" });
  }
  const checkpoint = parseDefenseCheckpoint(value.checkpoint);
  return checkpoint === null
    ? Object.freeze({ kind: "discarded", reason: "invalid" })
    : Object.freeze({ kind: "resume", checkpoint });
}

export function readDefenseSave(storage: DefenseStorage): DefenseSaveReadResult {
  const raw = storage.getItem(DEFENSE_SAVE_KEY);
  const result = parseDefenseSave(raw);
  if (result.kind === "discarded" && raw !== null) {
    storage.setItem(DEFENSE_RECOVERY_KEY, raw);
    storage.removeItem(DEFENSE_SAVE_KEY);
  }
  return result;
}

export function writeDefenseSave(storage: DefenseStorage, checkpoint: DefenseCheckpoint): void {
  storage.setItem(DEFENSE_SAVE_KEY, serializeDefenseSave(checkpoint));
}

export function clearDefenseSave(storage: DefenseStorage): void {
  storage.removeItem(DEFENSE_SAVE_KEY);
}
