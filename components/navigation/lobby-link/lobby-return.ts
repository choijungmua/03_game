import { LOBBY_EXIT_KEY } from "./constants";

/** 로비에서 이 경로로 나간다고 적어 둔다 (게임 오두막 입장·사이트 정보 링크) */
export function markLobbyExit(path: string) {
  try {
    sessionStorage.setItem(LOBBY_EXIT_KEY, path);
  } catch {}
}

/**
 * 지금 페이지가 로비에서 바로 들어온 곳인지 — 그렇다면 바로 앞 기록이 로비다.
 * ponytail: 마지막 한 경로만 기억한다. 로비 → 게임 A → 소개의 다른 게임 B → 뒤로(A)에서 A의 로비 링크는 B로 뒤로 간다. 드물어서 두고, 문제가 되면 경로 스택으로
 */
export function cameFromLobby() {
  try {
    return sessionStorage.getItem(LOBBY_EXIT_KEY) === window.location.pathname;
  } catch {
    return false;
  }
}
