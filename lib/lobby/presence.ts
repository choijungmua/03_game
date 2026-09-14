// 로비 오픈월드 멀티의 공용 타입·상수. 각 플레이어가 자기 위치를 짧은 주기로 보내고, 응답으로 근처 플레이어를 받는다.
// 위치 보정·때리기 판정·이름표 고르기는 백엔드(04_game_b src/lobby/presence.ts)가 한다

import { NAME_MAX, ZWJ } from "./constants";
import type { Outfit } from "./wardrobe";
import type { Facing } from "./world";

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
  /** 기기별 프로필 id(UUID). 서버가 채팅·낚시 이력을 이 id로 묶어 저장한다 */
  profileId?: string;
  /** 사용자가 정한 이름표 (cleanName을 거친 값). 없으면 서버가 고른 이름을 쓴다 */
  name?: string;
}

export interface PresenceResponse {
  /** 서버가 받아들인 내 상태 (순간이동 보정·기절이면 클라이언트가 따른다) */
  you: PublicPlayer;
  players: PublicPlayer[];
  online: number;
  /** 이번 때리기에 맞은 플레이어 id */
  hit: string | null;
}

/** 로비 WebSocket(백엔드 /api/lobby/ws)이 틱마다 보내는 메시지. 보내는 쪽은 PresenceRequest 그대로 */
export interface LobbyMessage extends PresenceResponse {
  /** 걸어서 갈 수 없는 거리라 서버가 내 위치를 고쳤으면 true. 이때만 내 캐릭터를 you 위치로 옮긴다 */
  corrected: boolean;
}

// 아래 값은 백엔드와 같아야 한다 (클라이언트가 쿨타임·말풍선을 미리 그린다)
/**
 * 서버가 근처 플레이어를 밀어 주는 간격. 클라이언트도 이 간격으로 내 상태를 보낸다 (초당 30번).
 * 50ms였을 때는 보내는 주기·서버 틱 대기만 평균 50ms, 최악 100ms가 붙어 남의 움직임이 늦게 보였다
 */
export const LOBBY_TICK_MS = 33;
/** 로비 정원이 차서 서버가 연결을 끊을 때의 코드 */
export const LOBBY_FULL_CODE = 1013;
export const ATTACK_MS = 320;
export const ATTACK_COOLDOWN_MS = 600;
/** 말풍선이 떠 있는 시간 */
export const CHAT_MS = 5000;
export const CHAT_MAX = 60;
export const CHAT_COOLDOWN_MS = 700;

const GRAPHEMES = new Intl.Segmenter("ko", { granularity: "grapheme" });

/** 눈에 한 글자로 보이는 단위로 나눈다 (조합 이모지·피부색 이모지도 한 글자) */
export function graphemes(text: string) {
  return Array.from(GRAPHEMES.segment(text), ({ segment }) => segment);
}

/** 제어·보이지 않는 문자와 줄바꿈을 공백 하나로 바꾸고 CHAT_MAX 글자로 자른다 (이모지 조합은 남기고, 반쪽 나지 않게 보이는 글자 단위로) */
export function cleanChat(text: string) {
  const flat = text
    .replace(/[\p{C}\s]/gu, (char) => (char === ZWJ ? char : " "))
    .replace(/ {2,}/g, " ")
    .trim();
  return graphemes(flat).slice(0, CHAT_MAX).join("").trim();
}

/** 이름표: 채팅처럼 정리하고 NAME_MAX 글자로 자른다. 이모티콘·낚시 표시와 헷갈리는 [[ ]]는 뺀다 (백엔드와 같은 규칙) */
export function cleanName(text: string) {
  return graphemes(cleanChat(text).replace(/[[\]]/g, "").trim()).slice(0, NAME_MAX).join("").trim();
}
