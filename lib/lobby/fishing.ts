import { ApiError, fetchApi, SERVER_ERROR_MESSAGE } from "@/lib/api-url";
import { FISH_CATCH_SLUGS, FISH_CATCHES } from "./constants";
import type { Satiety } from "./feeding";
import { type Outfit, sanitizeOutfit } from "./wardrobe";

export type FishCatch = (typeof FISH_CATCHES)[number];
export type FishInventory = Partial<Record<FishCatch, number>>;
export type FishingCommand = "start" | "stop" | "sync" | "consume" | "outfit";
export type FeedStatus = "fed" | "full" | "inedible" | "none" | null;
export type FishingState = {
  readonly active: boolean;
  readonly nextCatchAt: string | null;
  readonly inventory: FishInventory;
  readonly lastCatch: FishCatch | null;
  readonly caughtCount: number;
  readonly consumed: boolean;
  readonly feedStatus: FeedStatus;
  readonly satiety: Satiety;
  readonly affection: number;
  readonly satietyGain: number;
  readonly affectionGain: number;
  readonly outfit: Outfit;
};

export const fishCatchSrc = (name: FishCatch) =>
  `/assets/images/ui/lobby/fish-catches/${FISH_CATCH_SLUGS[name]}.${name === "황금인어" ? "png" : "webp"}`;

export async function syncFishing(profileId: string, token: string, command: FishingCommand, name?: FishCatch, outfit?: Outfit): Promise<FishingState> {
  const response = await fetchApi("/api/lobby/fishing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, token, command, ...(name && { catch: name }), ...(outfit && { outfit }) }),
  });
  if (!response.ok) throw new ApiError(SERVER_ERROR_MESSAGE, response.status || null);
  const state: unknown = await response.json().catch(() => {
    throw new ApiError(SERVER_ERROR_MESSAGE, response.status || null);
  });
  if (typeof state !== "object" || state === null) throw new Error("낚시 서버 응답이 올바르지 않아요");
  const active = Reflect.get(state, "active");
  const nextCatchAt = Reflect.get(state, "nextCatchAt");
  const inventory = Reflect.get(state, "inventory");
  const lastCatch = Reflect.get(state, "lastCatch");
  const caughtCount = Reflect.get(state, "caughtCount");
  const consumed = Reflect.get(state, "consumed");
  const feedStatus = Reflect.get(state, "feedStatus");
  const satiety = Reflect.get(state, "satiety");
  const affection = Reflect.get(state, "affection");
  const satietyGain = Reflect.get(state, "satietyGain");
  const affectionGain = Reflect.get(state, "affectionGain");
  const savedOutfit = Reflect.get(state, "outfit");
  const feedStatuses: readonly Exclude<FeedStatus, null>[] = ["fed", "full", "inedible", "none"];
  const parsedFeedStatus = feedStatus === null ? null : feedStatuses.find((value) => value === feedStatus);
  if (
    typeof active !== "boolean" ||
    (nextCatchAt !== null && typeof nextCatchAt !== "string") ||
    typeof inventory !== "object" ||
    inventory === null ||
    typeof caughtCount !== "number" ||
    typeof consumed !== "boolean" ||
    (feedStatus !== null && !parsedFeedStatus) ||
    typeof satiety !== "number" ||
    !Number.isFinite(satiety) ||
    satiety < 0 ||
    satiety > 100 ||
    typeof affection !== "number" ||
    !Number.isFinite(affection) ||
    affection < 0 ||
    affection > 100 ||
    typeof satietyGain !== "number" ||
    typeof affectionGain !== "number"
  ) {
    throw new Error("낚시 서버 응답이 올바르지 않아요");
  }
  const parsedInventory: FishInventory = {};
  for (const catchName of FISH_CATCHES) {
    const count = Reflect.get(inventory, catchName);
    if (typeof count === "number" && Number.isInteger(count) && count > 0) parsedInventory[catchName] = count;
  }
  return {
    active,
    nextCatchAt,
    inventory: parsedInventory,
    lastCatch: FISH_CATCHES.find((value) => value === lastCatch) ?? null,
    caughtCount,
    consumed,
    feedStatus: parsedFeedStatus ?? null,
    satiety: { value: satiety, at: Date.now() },
    affection,
    satietyGain,
    affectionGain,
    outfit: sanitizeOutfit(savedOutfit),
  };
}

export type FishEvent = { kind: "cast"; x: number; y: number } | { kind: "bite" } | { kind: "reel"; catch: FishCatch | null };
export interface FishingLine {
  x: number;
  y: number;
  castAt: number;
  biteAt: number;
  reelAt: number;
  catch: FishCatch | null;
}

export function fishChat(seq: number, event: FishEvent) {
  const arg = event.kind === "cast" ? `${Math.round(event.x)}:${Math.round(event.y)}` : event.kind === "reel" ? (event.catch ?? "") : "";
  return `[[fish:${seq % 1000}:${event.kind}:${arg}]]`;
}

const FISH_CHAT = /^\[\[fish:\d{1,3}:(cast|bite|reel):([^\]]*)\]\]$/;

export function parseFishChat(text: string): FishEvent | null {
  const match = FISH_CHAT.exec(text);
  if (!match) return null;
  const [, kind, arg] = match;
  if (kind === "bite") return arg === "" ? { kind: "bite" } : null;
  if (kind === "reel") {
    if (arg === "") return { kind: "reel", catch: null };
    const name = FISH_CATCHES.find((item) => item === arg);
    return name ? { kind: "reel", catch: name } : null;
  }
  if (!/^-?\d{1,8}:-?\d{1,8}$/.test(arg)) return null;
  const [x, y] = arg.split(":").map(Number);
  return { kind: "cast", x, y };
}

export function applyFishEvent(line: FishingLine | null, event: FishEvent, at: number): FishingLine | null {
  if (event.kind === "cast") return { x: event.x, y: event.y, castAt: at, biteAt: Infinity, reelAt: Infinity, catch: null };
  if (!line) return null;
  if (event.kind === "bite") return { ...line, biteAt: at };
  return { ...line, reelAt: at, catch: event.catch };
}
