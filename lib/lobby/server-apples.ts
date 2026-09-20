import { ApiError, fetchApi, SERVER_ERROR_MESSAGE } from "@/lib/api-url";
import { APPLE_KINDS, FISH_CATCHES } from "./constants";
import type { FishCatch, FishInventory } from "./fishing";

export type AppleState = {
  readonly trees: readonly number[];
  readonly lastCatch: FishCatch | null;
  readonly caughtCount: number;
  readonly inventory: FishInventory;
};

function parseAppleState(raw: unknown): AppleState | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const rawTrees = Reflect.get(raw, "trees");
  const rawLastCatch = Reflect.get(raw, "lastCatch");
  const rawCaughtCount = Reflect.get(raw, "caughtCount");
  const rawInventory = Reflect.get(raw, "inventory");
  if (!Array.isArray(rawTrees) || rawTrees.some((count) => typeof count !== "number" || !Number.isInteger(count))) return null;
  if (typeof rawCaughtCount !== "number" || !Number.isInteger(rawCaughtCount)) return null;
  if (typeof rawInventory !== "object" || rawInventory === null || Array.isArray(rawInventory)) return null;
  const inventory: FishInventory = {};
  for (const [name, count] of Object.entries(rawInventory)) {
    const catchName = FISH_CATCHES.find((candidate) => candidate === name);
    if (catchName && typeof count === "number" && Number.isInteger(count) && count > 0) inventory[catchName] = count;
  }
  return {
    trees: rawTrees.map((count) => Math.max(0, Math.min(3, count))),
    lastCatch: APPLE_KINDS.find((kind) => kind === rawLastCatch) ?? null,
    caughtCount: rawCaughtCount,
    inventory,
  };
}

export async function syncApples(profileId: string, token: string, command: "sync" | "pick", tree?: number): Promise<AppleState> {
  const response = await fetchApi("/api/lobby/apples", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, token, command, tree: tree ?? null }),
  });
  if (!response.ok) throw new ApiError(SERVER_ERROR_MESSAGE, response.status);
  const state = parseAppleState(await response.json());
  if (!state) throw new ApiError(SERVER_ERROR_MESSAGE, response.status);
  return state;
}
