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

/** 던지기(찌가 떨어질 물 위치) → 입질 → 당기기(낚은 것, 놓쳤으면 null) */
export type FishEvent = { kind: "cast"; x: number; y: number } | { kind: "bite" } | { kind: "reel"; catch: FishCatch | null };

/** 화면에 그리는 낚싯줄 하나. 시각은 performance.now 기준이고, 아직 안 일어난 단계는 Infinity */
export interface FishingLine {
  x: number;
  y: number;
  castAt: number;
  biteAt: number;
  reelAt: number;
  catch: FishCatch | null;
}

// ponytail: 낚시 동작을 채팅 글로 실어 보낸다 (백엔드 필드 추가 없이 이모티콘 [[emote:번호]]와 같은 방식).
// 서버 채팅 쿨타임에 걸리면 사이 동작이 빠질 수 있다 — 더 촘촘히 맞춰야 하면 PresenceRequest에 fishing 필드를 둘 것
/** seq는 같은 동작이 5초 안에 또 와도 새 채팅으로 알아보게 붙인다 */
export function fishChat(seq: number, event: FishEvent) {
  const arg = event.kind === "cast" ? `${Math.round(event.x)}:${Math.round(event.y)}` : event.kind === "reel" ? (event.catch ?? "") : "";
  return `[[fish:${seq % 1000}:${event.kind}:${arg}]]`;
}

const FISH_CHAT = /^\[\[fish:\d{1,3}:(cast|bite|reel):([^\]]*)\]\]$/;

/** 받은 채팅이 낚시 동작이면 그 동작, 아니면 null. 남이 보낸 글이라 모르는 물고기·이상한 좌표는 버린다 */
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

/** 받은 낚시 동작을 at 시각에 일어난 것으로 반영한다. 던지기를 못 보고 들어온 입질·당기기는 그릴 찌가 없어 버린다 */
export function applyFishEvent(line: FishingLine | null, event: FishEvent, at: number): FishingLine | null {
  if (event.kind === "cast") return { x: event.x, y: event.y, castAt: at, biteAt: Infinity, reelAt: Infinity, catch: null };
  if (!line) return null;
  if (event.kind === "bite") return { ...line, biteAt: at };
  return { ...line, reelAt: at, catch: event.catch };
}
