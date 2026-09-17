import { LOBBY_PROFILE_STORAGE_KEY } from "./constants";
import { cleanName } from "./presence";

/**
 * 로비 프로필. 이 기기(localStorage)에만 저장한다.
 * id는 서버가 채팅·낚시 이력을 묶는 기기별 UUID, token은 서버 가방(g_fishing)을 이 기기만 바꾸게 하는 비밀 값,
 * name은 사용자가 정한 이름표(비었으면 서버가 고른 이름)
 */
export interface LobbyProfile {
  id: string;
  token: string;
  name: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 저장된 글 → 프로필. id가 없거나 틀리면 newId로 새로 만들고, 이름은 다시 정리한다 */
export function parseLobbyProfile(raw: string | null, newId: () => string): LobbyProfile {
  let saved: Partial<LobbyProfile> | null = null;
  try {
    saved = JSON.parse(raw ?? "null");
  } catch {}
  const { id, token, name } = saved ?? {};
  // id만 있고 토큰이 없던 기기(서버 가방 이전)는 둘 다 새로 만든다 — 남의 가방을 물려받지 않게
  const known = typeof id === "string" && UUID.test(id) && typeof token === "string" && UUID.test(token);
  return {
    id: known ? id : newId(),
    token: known ? token : newId(),
    name: known && typeof name === "string" ? cleanName(name) : "",
  };
}

export function saveLobbyProfile(profile: LobbyProfile) {
  try {
    localStorage.setItem(LOBBY_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

/** 저장된 프로필을 읽는다. 처음이면 id를 만들어 저장해 두어 다음 방문에도 같은 id로 이력이 묶인다 */
export function loadLobbyProfile(): LobbyProfile {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LOBBY_PROFILE_STORAGE_KEY);
  } catch {}
  const profile = parseLobbyProfile(raw, () => crypto.randomUUID());
  saveLobbyProfile(profile);
  return profile;
}
