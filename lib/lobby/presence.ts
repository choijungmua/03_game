// 로비 오픈월드 멀티의 공용 타입·상수. 각 플레이어가 자기 위치를 짧은 주기로 보내고, 응답으로 근처 플레이어를 받는다.
// 위치 보정·때리기 판정은 백엔드(04_game_b)가 한다

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

// 아래 값은 백엔드와 같아야 한다 (클라이언트가 쿨타임·말풍선을 미리 그린다)
export const ATTACK_MS = 320;
export const ATTACK_COOLDOWN_MS = 600;
/** 말풍선이 떠 있는 시간 */
export const CHAT_MS = 5000;
export const CHAT_MAX = 60;
export const CHAT_COOLDOWN_MS = 700;

/** 제어·보이지 않는 문자와 줄바꿈을 공백 하나로 바꾸고 CHAT_MAX 글자로 자른다 (이모지가 반쪽 나지 않게 글자 단위로) */
export function cleanChat(text: string) {
  return [...text.replace(/[\p{C}\s]+/gu, " ").trim()].slice(0, CHAT_MAX).join("").trim();
}
