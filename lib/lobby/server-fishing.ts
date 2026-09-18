import { ApiError, fetchApi, SERVER_ERROR_MESSAGE } from "@/lib/api-url";

import { FISH_CATCHES } from "./constants";
import type { FishCatch, FishInventory } from "./fishing";
import { type Outfit, parseOutfit } from "./wardrobe";

/**
 * 가방·포만감·애정도·입은 옷은 서버(04_game_b → Supabase g_fishing)에 있다.
 * 기기마다 프로필 id와 토큰을 들고 다니며, 낚시 타이머도 서버가 돌려서 창을 닫아도 이어진다
 */
export type FishingCommand = "sync" | "start" | "stop" | "consume" | "outfit" | "pick";
/** 먹이 결과: 먹음·배부름·못 먹는 것·가방에 없음 */
export type FeedStatus = "fed" | "full" | "inedible" | "none";

export interface FishingState {
  /** 낚싯대를 드리운 채인지 (서버가 기억한다) */
  active: boolean;
  /** 다음 입질 시각(ISO 글). 안 낚는 중이면 null */
  nextCatchAt: string | null;
  inventory: FishInventory;
  /** 마지막으로 낚거나 딴 것 */
  lastCatch: FishCatch | null;
  /** 이번 요청에서 새로 들어온 개수 (창을 닫아 둔 동안 쌓인 것도 한 번에 온다) */
  caughtCount: number;
  consumed: boolean;
  feedStatus: FeedStatus | null;
  /** 0~100 */
  satiety: number;
  affection: number;
  outfit: Outfit;
}

const FEED_STATUSES: readonly FeedStatus[] = ["fed", "full", "inedible", "none"];

/** 서버가 준 상태. 모르는 이름·범위 밖 숫자는 버리고, 하나라도 모양이 다르면 null */
function parseFishingState(raw: Partial<Record<string, string | number | boolean | null | Partial<Record<string, number>>>> | null) {
  if (!raw || typeof raw !== "object") return null;
  const { active, nextCatchAt, lastCatch, caughtCount, consumed, feedStatus, satiety, affection } = raw;
  if (typeof active !== "boolean" || typeof consumed !== "boolean") return null;
  if (typeof caughtCount !== "number" || typeof satiety !== "number" || typeof affection !== "number") return null;
  if (nextCatchAt !== null && typeof nextCatchAt !== "string") return null;

  const inventory: FishInventory = {};
  const rawInventory = raw.inventory;
  if (typeof rawInventory === "object" && rawInventory !== null) {
    for (const name of FISH_CATCHES) {
      const count = rawInventory[name];
      if (typeof count === "number" && Number.isInteger(count) && count > 0) inventory[name] = count;
    }
  }

  const state: FishingState = {
    active,
    nextCatchAt,
    inventory,
    lastCatch: FISH_CATCHES.find((name) => name === lastCatch) ?? null,
    caughtCount,
    consumed,
    feedStatus: FEED_STATUSES.find((status) => status === feedStatus) ?? null,
    satiety: Math.max(0, Math.min(100, satiety)),
    affection: Math.max(0, Math.min(100, affection)),
    outfit: parseOutfit(JSON.stringify(raw.outfit ?? {})),
  };
  return state;
}

/**
 * 서버에 낚시 상태를 묻고 바꾼다. consume은 먹일 것, outfit은 입은 옷을 함께 보낸다.
 * 실패하면 한국어 ApiError를 던진다 (부르는 쪽에서 안내 글로 보여 준다)
 */
export async function syncFishing(
  profileId: string,
  token: string,
  command: FishingCommand,
  name?: FishCatch,
  outfit?: Outfit,
): Promise<FishingState> {
  const response = await fetchApi("/api/lobby/fishing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, token, command, catch: name ?? null, outfit: outfit ?? null }),
  });
  if (!response.ok) throw new ApiError(SERVER_ERROR_MESSAGE, response.status);
  const state = parseFishingState(await response.json());
  if (!state) throw new ApiError(SERVER_ERROR_MESSAGE, response.status);
  return state;
}
