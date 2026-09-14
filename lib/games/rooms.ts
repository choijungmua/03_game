// 초대 코드로 두 명(흑·백)이 한 판을 두는 온라인 대전의 공용 타입. 방 저장소·판정은 백엔드(04_game_b)에 있다
import type { RoomEmote } from "./emotes";

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
  /** 컴퓨터와 두는 방인지 (봇은 늘 백) */
  bot: boolean;
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
