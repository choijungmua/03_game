import { EAT_MS, FISH_CATCHES, FOOD_SATIETY, HEART_LINGER_MS, SATIETY_DECAY_MS, SATIETY_MAX, SATIETY_STORAGE_KEY } from "./constants";
import { type FishCatch, type FishInventory, loadFishInventory, recordCatch } from "./fishing";

/** 저장한 포만감과 저장한 시각(Date.now). 지금 포만감은 currentSatiety로 시간만큼 깎아 읽는다 */
export interface Satiety {
  value: number;
  at: number;
}

export const currentSatiety = (saved: Satiety, now: number) =>
  Math.max(0, Math.min(SATIETY_MAX, saved.value - Math.max(0, now - saved.at) / SATIETY_DECAY_MS));

/** 저장된 글 → 포만감. 망가졌으면 배고픈 상태 */
export function parseSatiety(raw: string | null): Satiety {
  try {
    const parsed: Partial<Satiety> | null = JSON.parse(raw ?? "null");
    if (parsed && typeof parsed.value === "number" && typeof parsed.at === "number" && Number.isFinite(parsed.value + parsed.at)) {
      return { value: parsed.value, at: parsed.at };
    }
  } catch {}
  return { value: 0, at: 0 };
}

export function loadSatiety(): Satiety {
  try {
    return parseSatiety(localStorage.getItem(SATIETY_STORAGE_KEY));
  } catch {
    return { value: 0, at: 0 };
  }
}

export type FeedResult =
  | { ok: true; inventory: FishInventory; satiety: Satiety }
  | { ok: false; reason: "none" | "inedible" | "full" };

/** 가방에서 하나 꺼내 먹인다. 없거나 못 먹는 것이거나 배가 가득이면 아무것도 안 바꾼다 */
export function feedCapybara(name: FishCatch, now: number): FeedResult {
  if (!loadFishInventory()[name]) return { ok: false, reason: "none" };
  if (FOOD_SATIETY[name] <= 0) return { ok: false, reason: "inedible" };
  const before = currentSatiety(loadSatiety(), now);
  if (before >= SATIETY_MAX) return { ok: false, reason: "full" };
  const satiety = { value: Math.min(SATIETY_MAX, before + FOOD_SATIETY[name]), at: now };
  try {
    localStorage.setItem(SATIETY_STORAGE_KEY, JSON.stringify(satiety));
  } catch {}
  return { ok: true, inventory: recordCatch(name, -1), satiety };
}

/** 먹는 중인 것과 먹기 시작한 시각(performance.now) */
export interface Meal {
  name: FishCatch;
  at: number;
}

/** 하트까지 다 사라졌는지 */
export const mealDone = (meal: Meal, now: number) => now > meal.at + EAT_MS + HEART_LINGER_MS;

// 낚시 동작(fishChat)과 같은 방식으로 먹는 걸 채팅 글로 실어 보낸다
export const feedChat = (seq: number, name: FishCatch) => `[[feed:${seq % 1000}:${name}]]`;

const FEED_CHAT = /^\[\[feed:\d{1,3}:([^\]]+)\]\]$/;

/** 받은 채팅이 먹이기면 먹은 것, 아니면 null. 모르는·못 먹는 이름은 버린다 */
export function parseFeedChat(text: string): FishCatch | null {
  const arg = FEED_CHAT.exec(text)?.[1];
  const name = FISH_CATCHES.find((item) => item === arg);
  return name && FOOD_SATIETY[name] > 0 ? name : null;
}
