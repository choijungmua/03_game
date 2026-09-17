import { EAT_MS, FISH_CATCHES, FOOD_SATIETY, HEART_LINGER_MS, SATIETY_DECAY_MS, SATIETY_MAX } from "./constants";
import { type FishCatch } from "./fishing";

/** 저장한 포만감과 저장한 시각(Date.now). 지금 포만감은 currentSatiety로 시간만큼 깎아 읽는다 */
export interface Satiety {
  value: number;
  at: number;
}

export const currentSatiety = (saved: Satiety, now: number) =>
  Math.max(0, Math.min(SATIETY_MAX, saved.value - Math.max(0, now - saved.at) / SATIETY_DECAY_MS));

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
