// 초대 코드로 두 명(흑·백)이 한 판을 두는 온라인 대전 공용 방 관리. 규칙(logic)만 게임마다 다르다
import { CAPYBARA_EMOTES, EMOTE_SHOW_MS, type RoomEmote } from "./emotes";

export type Stone = "black" | "white";
export type Cell = Stone | null;

export function opponent(stone: Stone): Stone {
  return stone === "black" ? "white" : "black";
}

export type MoveResult<S> = { ok: true; state: S } | { ok: false; error: string };

/** 알까기처럼 방향·세기가 필요한 행동에 쓰는 벡터 */
export interface Vector {
  x: number;
  y: number;
}

export interface RoomState {
  /** 끝난 판이면 채워진다 (클라이언트 폴링 중단 기준) */
  endReason: string | null;
  turn: Stone;
  /** 지금 차례가 시작된 서버 시각(ms). 상대가 들어오기 전과 끝난 뒤에는 null */
  turnStartedAt: number | null;
}

export interface RoomRules<S extends RoomState, A extends string> {
  actions: readonly A[];
  /** 한 수 제한시간. 넘기면 timeOut으로 끝낸다 */
  turnTimeMs: number;
  create(): S;
  act(state: S, action: { type: A; index?: number; aim?: Vector }, seat: Stone): MoveResult<S>;
  timeOut(state: S, stone: Stone): S;
}

export interface RoomView<S> {
  code: string;
  state: S;
  joined: Record<Stone, boolean>;
  /** 요청한 토큰의 자리. 토큰이 없거나 틀리면 null(관전) */
  you: Stone | null;
  /** 응답 시점 서버 시각(ms). 클라이언트 시계와의 차이를 보정해 남은 시간을 센다 */
  now: number;
  /** 방 상태가 바뀔 때마다 1씩 오른다. 늦게 도착한 옛날 응답을 클라이언트가 버리는 기준 */
  version: number;
  /** 마지막으로 보낸 놀리기 이모티콘 */
  emote: RoomEmote | null;
}

export interface RoomAction {
  type: string;
  token?: string;
  index?: number;
  aim?: Vector;
}

export type RoomResult<S> =
  | { ok: true; view: RoomView<S>; token: string | null }
  | { ok: false; error: string; status: 400 | 403 | 404 | 409 };

export interface RoomStore<S> {
  createRoom(): RoomResult<S>;
  readRoom(code: string, token: string | null): RoomResult<S>;
  actOnRoom(code: string, action: RoomAction): RoomResult<S>;
}

interface Room<S> {
  code: string;
  state: S;
  tokens: Record<Stone, string | null>;
  updatedAt: number;
  version: number;
  emote: RoomEmote | null;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/O/1/I 제외, 32자
const CODE_LENGTH = 6;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
// 마감 직전에 둔 수가 네트워크 지연으로 늦게 도착해도 시간패가 되지 않게 봐주는 시간
const TIMEOUT_GRACE_MS = 1000;

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

// ponytail: 서버 메모리에 방을 둔다 — 서버 한 대(next start)에서만 동작.
// 서버리스·여러 인스턴스로 배포하면 이 Map을 Redis/Supabase 같은 공유 저장소로 바꿀 것 (dev HMR에서 살아남도록 globalThis에 둠)
export function createRoomStore<S extends RoomState, A extends string>(key: string, rules: RoomRules<S, A>): RoomStore<S> {
  const store = globalThis as typeof globalThis & { gameRooms?: Map<string, Map<string, Room<S>>> };
  const allRooms = (store.gameRooms ??= new Map());
  const rooms = allRooms.get(key) ?? new Map<string, Room<S>>();
  allRooms.set(key, rooms);

  function seatOf(room: Room<S>, token: string | null | undefined): Stone | null {
    if (!token) return null;
    if (room.tokens.black === token) return "black";
    if (room.tokens.white === token) return "white";
    return null;
  }

  function toView(room: Room<S>, token: string | null | undefined): RoomView<S> {
    return {
      code: room.code,
      state: room.state,
      joined: { black: room.tokens.black !== null, white: room.tokens.white !== null },
      you: seatOf(room, token),
      now: Date.now(),
      version: room.version,
      emote: room.emote,
    };
  }

  // 서버에서 타이머를 돌리지 않고, 방을 읽거나 둘 때 제한시간이 지났으면 그 차례인 쪽을 시간패로 끝낸다.
  // 두 사람 모두 1초마다 폴링하므로 늦어도 1초 안에 반영된다
  function expire(room: Room<S>) {
    const { state } = room;
    if (state.endReason || state.turnStartedAt === null) return;
    if (Date.now() - state.turnStartedAt <= rules.turnTimeMs + TIMEOUT_GRACE_MS) return;
    room.state = { ...rules.timeOut(state, state.turn), turnStartedAt: null };
    room.updatedAt = Date.now();
    room.version += 1;
  }

  function findRoom(code: string) {
    const room = rooms.get(code.toUpperCase());
    if (room) expire(room);
    return room;
  }

  return {
    createRoom() {
      const now = Date.now();
      for (const [code, room] of rooms) {
        if (now - room.updatedAt > ROOM_TTL_MS) rooms.delete(code);
      }

      let code = makeCode();
      while (rooms.has(code)) code = makeCode();

      const token = crypto.randomUUID();
      const room: Room<S> = { code, state: rules.create(), tokens: { black: token, white: null }, updatedAt: now, version: 1, emote: null };
      rooms.set(code, room);
      return { ok: true, view: toView(room, token), token };
    },

    readRoom(code, token) {
      const room = findRoom(code);
      if (!room) return { ok: false, error: "없는 초대 코드예요", status: 404 };
      return { ok: true, view: toView(room, token), token: null };
    },

    actOnRoom(code, action) {
      const room = findRoom(code);
      if (!room) return { ok: false, error: "없는 초대 코드예요", status: 404 };

      const seat = seatOf(room, action.token);

      if (action.type === "join") {
        if (seat) return { ok: true, view: toView(room, action.token), token: action.token ?? null };
        if (room.tokens.white) return { ok: false, error: "이미 두 명이 들어간 방이에요", status: 409 };
        const token = crypto.randomUUID();
        room.tokens.white = token;
        room.updatedAt = Date.now();
        // 상대가 들어온 순간부터 흑의 첫 수 시간이 흐른다
        room.state = { ...room.state, turnStartedAt: room.updatedAt };
        room.version += 1;
        return { ok: true, view: toView(room, token), token };
      }

      // 놀리기 이모티콘은 차례와 상관없이 대국자 누구나 보낸다. 판 상태는 그대로, 버전만 올려 폴링에 실어 보낸다
      if (action.type === "emote") {
        if (!seat) return { ok: false, error: "이 방의 대국자가 아니에요", status: 403 };
        const id = action.index ?? -1;
        if (!Number.isInteger(id) || !CAPYBARA_EMOTES[id]) return { ok: false, error: "없는 이모티콘이에요", status: 400 };
        if (room.emote && Date.now() - room.emote.at < EMOTE_SHOW_MS) {
          return { ok: false, error: "이모티콘이 사라지면 다시 보낼 수 있어요", status: 409 };
        }
        room.updatedAt = Date.now();
        room.emote = { seat, id, at: room.updatedAt };
        room.version += 1;
        return { ok: true, view: toView(room, action.token), token: null };
      }

      const type = rules.actions.find((name) => name === action.type);
      if (!type) return { ok: false, error: "잘못된 요청이에요", status: 400 };
      if (!seat) return { ok: false, error: "이 방의 대국자가 아니에요", status: 403 };
      if (!room.tokens.white) return { ok: false, error: "상대가 아직 들어오지 않았어요", status: 409 };

      const result = rules.act(room.state, { type, index: action.index, aim: action.aim }, seat);
      if (!result.ok) return { ok: false, error: result.error, status: 409 };
      room.updatedAt = Date.now();
      room.state = { ...result.state, turnStartedAt: result.state.endReason ? null : room.updatedAt };
      room.version += 1;
      return { ok: true, view: toView(room, action.token), token: null };
    },
  };
}
