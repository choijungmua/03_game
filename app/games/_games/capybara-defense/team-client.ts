import { ApiError, fetchApi } from "@/lib/api-url";
import { RARITIES } from "./engine";
import type { DefenseCommand, DefenseState } from "./engine";

export type TeamCommand = DefenseCommand | { readonly type: "ready" } | { readonly type: "leave" };
export type DefenseRoomView = {
  readonly protocol: 1;
  readonly code: string;
  readonly version: number;
  readonly tick: number;
  readonly now: number;
  readonly mode?: "survival";
  readonly matchPhase?: "waiting" | "playing" | "finished";
  readonly you: number;
  readonly host: number;
  readonly players: readonly {
    readonly slot: number;
    readonly ready: boolean;
    readonly connected: boolean;
    readonly phase?: DefenseState["phase"];
    readonly round?: number;
    readonly enemies?: number;
    readonly rank?: number | null;
  }[];
  readonly pausedReason: null | "host" | "disconnected";
  readonly state: DefenseState;
};
export type TeamSession = { readonly code: string; readonly token: string };
export class TeamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export function newerView(
  current: DefenseRoomView | null,
  incoming: DefenseRoomView,
) {
  return !current ||
    current.code !== incoming.code ||
    incoming.version > current.version ||
    (incoming.version === current.version && incoming.now >= current.now)
    ? incoming
    : current;
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const id = (value: unknown): value is number => finite(value) && Number.isSafeInteger(value) && value > 0;
const nullableId = (value: unknown) => value === null || id(value);
const rarity = (value: unknown) => RARITIES.some(item => item.id === value);
const classId = (value: unknown) => value === "warrior" || value === "archer" || value === "mage";
const slot = (value: unknown) => finite(value) && Number.isInteger(value) && value >= 0 && value < 4;
const numbers = (value: Record<string, unknown>, keys: readonly string[]) => keys.every(key => finite(value[key]));
const list = (value: unknown, valid: (item: unknown) => boolean) => Array.isArray(value) && value.length <= 1000 && value.every(valid);
function state(value: unknown): value is DefenseState {
  return record(value) && ["idle", "playing", "paused", "won", "lost"].some(phase => value.phase === phase)
    && numbers(value, ["seed", "rngState", "round", "elapsedMs", "roundElapsedMs", "gold", "gas", "kills", "nextId", "spawnedThisRound", "tickRemainderMs"])
    && (value.speed === 1 || value.speed === 2 || value.speed === 4)
    && typeof value.finalBossDefeated === "boolean" && (value.resultReason === null || typeof value.resultReason === "string")
    && record(value.classLevels) && numbers(value.classLevels, ["warrior", "archer", "mage"])
    && list(value.units, unit => record(unit) && id(unit.id) && classId(unit.classId) && rarity(unit.rarity)
      && (unit.cellIndex === null || (finite(unit.cellIndex) && Number.isSafeInteger(unit.cellIndex) && unit.cellIndex >= 0))
      && (unit.position === null || (record(unit.position) && numbers(unit.position, ["x", "y"])))
      && numbers(unit, ["cooldownMs", "mana"]) && nullableId(unit.focusEnemyId))
    && list(value.enemies, enemy => record(enemy) && id(enemy.id) && typeof enemy.name === "string"
      && ["small", "medium", "large"].some(size => enemy.size === size) && typeof enemy.isBoss === "boolean"
      && (enemy.deadlineMs === null || finite(enemy.deadlineMs))
      && numbers(enemy, ["round", "progress", "hp", "maxHp", "shield", "maxShield", "armor", "lockedUntilMs", "slowedUntilMs", "gasReward"]))
    && list(value.tickets, ticket => record(ticket) && id(ticket.id) && rarity(ticket.rarity))
    && list(value.registeredCollections, item => typeof item === "string") && list(value.killMilestones, finite);
}
function roomView(value: unknown): value is DefenseRoomView {
  return record(value) && value.protocol === 1 && typeof value.code === "string" && /^[A-F0-9]{8}$/.test(value.code)
    && numbers(value, ["version", "tick", "now"]) && slot(value.you) && slot(value.host)
    && (value.pausedReason === null || value.pausedReason === "host" || value.pausedReason === "disconnected")
    && Array.isArray(value.players) && value.players.length >= 1 && value.players.length <= 4
    && value.players.every((player: unknown) => record(player) && slot(player.slot) && typeof player.ready === "boolean" && typeof player.connected === "boolean"
      && (value.mode !== "survival" || (["idle", "playing", "won", "lost"].includes(String(player.phase)) && numbers(player, ["round", "enemies"]) && (player.rank === null || (id(player.rank) && player.rank <= 4)))))
    && (value.mode === undefined || value.mode === "survival" && ["waiting", "playing", "finished"].includes(String(value.matchPhase)))
    && state(value.state);
}
type JoinedRoom = { token: string; view: DefenseRoomView };
function joinedRoom(value: unknown): value is JoinedRoom {
  return record(value) && typeof value.token === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.token) && roomView(value.view);
}
const INVALID_RESPONSE = "게임 서버 응답을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.";
async function request<T>(
  path: string,
  valid: (value: unknown) => value is T,
  session?: TeamSession,
  payload?: unknown,
): Promise<T> {
  let response: Response;
  try { response = await fetchApi(`/api/defense/rooms${path}`, {
    method: payload === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    cache: "no-store",
  }, 5000); } catch (cause) {
    if (cause instanceof ApiError) throw new TeamError(cause.message, cause.status ?? 0);
    throw cause;
  }
  let result: unknown;
  try { result = await response.json(); } catch (cause) {
    if (cause instanceof Error || cause instanceof DOMException) throw new TeamError(INVALID_RESPONSE, response.status);
    throw cause;
  }
  if (!response.ok)
    throw new TeamError(
      record(result) && typeof result.error === "string"
        ? result.error
        : "연결할 수 없어요. 다시 시도해 주세요.",
      response.status,
    );
  if (!valid(result)) throw new TeamError(INVALID_RESPONSE, response.status);
  return result;
}
export const teamClient = {
  create: () =>
    request("", joinedRoom, undefined, { mode: "survival" }),
  join: (code: string) =>
    request(
      `/${encodeURIComponent(code)}/join`,
      joinedRoom,
      undefined,
      {},
    ),
  read: (session: TeamSession) =>
    request(`/${session.code}`, roomView, session),
  send: (
    session: TeamSession,
    command: TeamCommand,
    requestId = crypto.randomUUID(),
  ) =>
    request(`/${session.code}/actions`, roomView, session, {
      requestId,
      command,
    }),
};
