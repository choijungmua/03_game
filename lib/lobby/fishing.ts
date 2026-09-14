import { FISH_CATCHES, FISH_INVENTORY_STORAGE_KEY } from "./constants";

export type FishCatch = (typeof FISH_CATCHES)[number];
/** 낚은 것별 횟수. 한 번도 안 낚은 건 비어 있다. 이 기기(localStorage)에만 저장한다 */
export type FishInventory = Partial<Record<FishCatch, number>>;

/** 저장된 글 → 낚시 가방. 모르는 이름·0 이하·소수는 버린다 */
export function parseFishInventory(raw: string | null): FishInventory {
  const inventory: FishInventory = {};
  try {
    const parsed: Partial<Record<string, number>> | null = JSON.parse(raw ?? "null");
    if (typeof parsed !== "object" || parsed === null) return inventory;
    for (const name of FISH_CATCHES) {
      const count = parsed[name];
      if (typeof count === "number" && Number.isInteger(count) && count > 0) inventory[name] = count;
    }
  } catch {}
  return inventory;
}

export function loadFishInventory(): FishInventory {
  try {
    return parseFishInventory(localStorage.getItem(FISH_INVENTORY_STORAGE_KEY));
  } catch {
    return {};
  }
}

/** 한 번 더 낚은 것으로 저장하고 새 가방을 돌려준다 */
export function recordCatch(name: FishCatch): FishInventory {
  const next = loadFishInventory();
  next[name] = (next[name] ?? 0) + 1;
  try {
    localStorage.setItem(FISH_INVENTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}
