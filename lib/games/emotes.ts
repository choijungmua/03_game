// 온라인 대전(오목·바둑 등)에서 상대를 놀리는 카피바라 이모티콘. 배열 순서(0부터)가 서버로 보내는 번호다 — 중간에 끼워 넣지 말고 뒤에 추가할 것
// 그림은 public/assets/images/characters/capybara/emotes/capybara-emote-<번호>.webp (원본 시트: assets-src/characters/capybara/emotes/)
export const CAPYBARA_EMOTES = [
  "ㅋㅋㅋㅋㅋ",
  "메롱~",
  "하품 나온다…",
  "이게 실력이지",
  "귤 먹으면서 둬도 이기겠다",
  "온천 다녀와도 되지?",
  "거북이도 너보단 빠르겠다",
  "거기 두는 거 맞아?",
  "빠이빠이~",
  "내 차례 언제 와… zzZ",
  "너무 쉬운데?",
  "너 지금 떨고 있지?",
  "살살 해줄게",
  "벌써 이긴 기분~",
  "평온… 너무 평온…",
  "카피바라 무시하지 마라",
] as const;

/** 이모티콘이 화면에 떠 있는 시간. 떠 있는 동안에는 누구도 새 이모티콘을 못 보낸다 (도배 방지) */
export const EMOTE_SHOW_MS = 5000;

export function emoteImage(id: number) {
  return `/assets/images/characters/capybara/emotes/capybara-emote-${id}.webp`;
}

/** 로비에서 보내는 이모티콘. 채팅 한 줄로 실어 보내서 서버·동기화·쿨타임을 채팅과 똑같이 쓴다 */
export function emoteChat(id: number) {
  return `[[emote:${id}]]`;
}

/** 채팅이 이모티콘 하나뿐이면 그 번호, 아니면 null */
export function parseEmoteChat(text: string) {
  const match = /^\[\[emote:(\d+)\]\]$/.exec(text);
  const id = match ? Number(match[1]) : -1;
  return id >= 0 && id < CAPYBARA_EMOTES.length ? id : null;
}

/** 방에 마지막으로 보낸 이모티콘. at이 바뀌면 화면에 새로 띄운다 */
export interface RoomEmote {
  seat: "black" | "white";
  /** CAPYBARA_EMOTES 번호 */
  id: number;
  at: number;
}
