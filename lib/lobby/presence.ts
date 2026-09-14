// 로비 오픈월드 멀티: 각 플레이어가 자기 위치를 짧은 주기로 보내고, 응답으로 근처 플레이어를 받는다.
// 맵은 하나라 모두 같은 공간에 있다. 때리기 판정도 서버가 한다 (앞쪽 가까운 한 명을 2초 기절)

import { CAPYBARA_ADJECTIVES, CAPYBARA_NAMES } from "./constants";
import { type Outfit, sanitizeOutfit } from "./wardrobe";
import { type Facing, FACING_VECTORS, FACINGS, TILE, WALK_SPEED } from "./world";

export interface PlayerState {
  x: number;
  y: number;
  facing: Facing;
  sitting: boolean;
  /** 입은 옷. 모두에게 보인다 */
  outfit: Outfit;
}

export interface PublicPlayer extends PlayerState {
  /** 화면에 보이는 짧은 id. 토큰은 절대 다른 사람에게 보내지 않는다 */
  id: string;
  /** 머리 위 이름표 ("졸린 치킨바라"). 접속 중인 사람끼리는 안 겹친다 */
  name: string;
  /** 남은 기절 시간(ms). 서버·클라이언트 시계가 달라서 시각이 아니라 남은 시간으로 보낸다 */
  stunMs: number;
  /** 남은 때리기 동작 시간(ms) */
  attackMs: number;
  /** 머리 위 말풍선. 보여줄 시간이 끝났으면 빈 문자열 */
  chat: string;
  chatMs: number;
}

export interface PresenceRequest extends PlayerState {
  token: string;
  /** 이번 동기화 사이에 때리기를 눌렀는지 */
  attack: boolean;
  /** 이번 동기화 사이에 보낸 채팅 (cleanChat을 거친 값) */
  chat?: string;
}

export interface PresenceResponse {
  /** 서버가 받아들인 내 상태 (순간이동 보정·기절이면 클라이언트가 따른다) */
  you: PublicPlayer;
  players: PublicPlayer[];
  online: number;
  /** 이번 때리기에 맞은 플레이어 id */
  hit: string | null;
}

interface Player extends PlayerState {
  id: string;
  name: string;
  token: string;
  updatedAt: number;
  stunnedUntil: number;
  attackUntil: number;
  attackReadyAt: number;
  chat: string;
  chatUntil: number;
  chatReadyAt: number;
}

export const STALE_MS = 10_000;
/** 이 거리 안의 플레이어만 보낸다 (화면 밖 사람까지 보내면 사람이 많을 때 응답이 커진다) */
export const VIEW_RADIUS = 2000;
export const STUN_MS = 2000;
export const ATTACK_MS = 320;
export const ATTACK_COOLDOWN_MS = 600;
/** 주먹이 닿는 거리(px) */
export const ATTACK_REACH = 64;
/** 말풍선이 떠 있는 시간 */
export const CHAT_MS = 5000;
export const CHAT_MAX = 60;
export const CHAT_COOLDOWN_MS = 700;
const MAX_VISIBLE = 60;
const MAX_PLAYERS = 500;
/** 네트워크 지연·프레임 튐을 봐주는 여유 */
const MOVE_SLACK = TILE * 2;

// ponytail: 서버 메모리에 플레이어를 둔다 — rooms.ts와 같은 한계(서버 한 대에서만 동작).
// 서버리스·여러 인스턴스 배포면 Redis 같은 공유 저장소 + WebSocket으로 교체. 서버 충돌 검사도 없음(순간이동만 막음)
function allPlayers() {
  const store = globalThis as typeof globalThis & { lobbyPlayers?: Map<string, Player> };
  return (store.lobbyPlayers ??= new Map());
}

/** 지금 접속 중인 사람과 겹치지 않는 이름을 무작위 자리부터 찾는다. 조합 수가 MAX_PLAYERS보다 많아 늘 찾아진다 */
function pickName(players: Map<string, Player>) {
  const taken = new Set([...players.values()].map((player) => player.name));
  const total = CAPYBARA_ADJECTIVES.length * CAPYBARA_NAMES.length;
  const start = Math.floor(Math.random() * total);
  for (let step = 0; step < total; step++) {
    const index = (start + step) % total;
    const name = `${CAPYBARA_ADJECTIVES[Math.floor(index / CAPYBARA_NAMES.length)]} ${CAPYBARA_NAMES[index % CAPYBARA_NAMES.length]}`;
    if (!taken.has(name)) return name;
  }
  return "카피바라";
}

/** 제어·보이지 않는 문자와 줄바꿈을 공백 하나로 바꾸고 CHAT_MAX 글자로 자른다 (이모지가 반쪽 나지 않게 글자 단위로) */
export function cleanChat(text: string) {
  return [...text.replace(/[\p{C}\s]+/gu, " ").trim()].slice(0, CHAT_MAX).join("").trim();
}

/** 요청 본문 검증. 바깥 입력이라 필드마다 타입을 확인한다 */
export function parsePresence(body: Partial<PresenceRequest> | null): PresenceRequest | null {
  if (!body) return null;
  const { token, x, y, facing, sitting, attack, outfit, chat } = body;
  if (typeof token !== "string" || token.length < 16 || token.length > 64) return null;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Math.abs(x) > 1e7 || Math.abs(y) > 1e7) return null;
  const direction = FACINGS.find((name) => name === facing);
  if (!direction || typeof sitting !== "boolean") return null;
  // 옷은 없거나 틀려도 요청을 거절하지 않고 아는 옷만 남긴다
  const message = typeof chat === "string" ? cleanChat(chat) : "";
  return {
    token,
    x,
    y,
    facing: direction,
    sitting,
    attack: attack === true,
    outfit: sanitizeOutfit(outfit),
    ...(message && { chat: message }),
  };
}

const toPublic = (player: Player, now: number): PublicPlayer => ({
  id: player.id,
  name: player.name,
  x: player.x,
  y: player.y,
  facing: player.facing,
  sitting: player.sitting,
  outfit: player.outfit,
  stunMs: Math.max(0, player.stunnedUntil - now),
  attackMs: Math.max(0, player.attackUntil - now),
  chat: now < player.chatUntil ? player.chat : "",
  chatMs: Math.max(0, player.chatUntil - now),
});

/** 바라보는 방향 앞쪽(±70°) 주먹 거리 안에서 가장 가까운, 아직 기절하지 않은 플레이어 */
function findTarget(attacker: Player, players: Iterable<Player>, now: number) {
  const [fx, fy] = FACING_VECTORS[attacker.facing];
  let best: Player | null = null;
  let bestDistance = ATTACK_REACH;
  for (const other of players) {
    if (other === attacker || now < other.stunnedUntil) continue;
    const dx = other.x - attacker.x;
    const dy = other.y - attacker.y;
    const distance = Math.hypot(dx, dy);
    if (distance > bestDistance) continue;
    // 거의 겹쳐 있으면 방향과 상관없이 맞는다
    if (distance > 12 && (dx * fx + dy * fy) / distance < 0.35) continue;
    best = other;
    bestDistance = distance;
  }
  return best;
}

export function updatePresence(request: PresenceRequest, now = Date.now()): PresenceResponse | null {
  const players = allPlayers();
  for (const [token, player] of players) {
    if (now - player.updatedAt > STALE_MS) players.delete(token);
  }

  let me = players.get(request.token);
  if (!me) {
    if (players.size >= MAX_PLAYERS) return null;
    me = {
      x: request.x,
      y: request.y,
      facing: request.facing,
      sitting: request.sitting,
      outfit: request.outfit,
      id: crypto.randomUUID().slice(0, 6),
      name: pickName(players),
      token: request.token,
      updatedAt: now,
      stunnedUntil: 0,
      attackUntil: 0,
      attackReadyAt: 0,
      chat: "",
      chatUntil: 0,
      chatReadyAt: 0,
    };
    players.set(request.token, me);
  } else if (now < me.stunnedUntil) {
    // 기절 중엔 움직임·앉기·방향 전환을 받지 않는다
    me.sitting = false;
    me.outfit = request.outfit;
    me.updatedAt = now;
  } else {
    // 걸어서 갈 수 있는 거리보다 멀리 가면 그 방향으로 갈 수 있는 만큼만 인정한다
    const allowed = (WALK_SPEED * 1.25 * (now - me.updatedAt)) / 1000 + MOVE_SLACK;
    const dx = request.x - me.x;
    const dy = request.y - me.y;
    const distance = Math.hypot(dx, dy);
    const ratio = distance > allowed ? allowed / distance : 1;
    me.x += dx * ratio;
    me.y += dy * ratio;
    me.facing = request.facing;
    me.sitting = request.sitting;
    me.outfit = request.outfit;
    me.updatedAt = now;
  }

  let hit: string | null = null;
  if (request.attack && now >= me.stunnedUntil && now >= me.attackReadyAt) {
    me.attackUntil = now + ATTACK_MS;
    me.attackReadyAt = now + ATTACK_COOLDOWN_MS;
    me.sitting = false;
    const target = findTarget(me, players.values(), now);
    if (target) {
      target.stunnedUntil = now + STUN_MS;
      target.sitting = false;
      hit = target.id;
    }
  }

  // 기절 중에도 말은 할 수 있다. 쿨타임 안에 온 채팅은 버린다 (도배 방지)
  const chat = request.chat ? cleanChat(request.chat) : "";
  if (chat && now >= me.chatReadyAt) {
    me.chat = chat;
    me.chatUntil = now + CHAT_MS;
    me.chatReadyAt = now + CHAT_COOLDOWN_MS;
  }

  const self = me;
  const nearby = [...players.values()]
    .filter((player) => player !== self && Math.hypot(player.x - self.x, player.y - self.y) <= VIEW_RADIUS)
    .slice(0, MAX_VISIBLE)
    .map((player) => toPublic(player, now));

  return { you: toPublic(self, now), players: nearby, online: players.size, hit };
}
