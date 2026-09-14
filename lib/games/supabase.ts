// 브라우저 -> 백엔드(04_game_b) -> Supabase: 게임 입장 수·한 판 기록·공유 적재. 실패해도 게임에는 영향 없음

import { API_URL } from "@/lib/api-url";

const SESSION_KEY = "game-session-id";

/** 브라우저 탭 단위 세션 id. 같은 탭에서의 입장·기록은 같은 id로 묶인다 */
function getSessionId() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function post(slug: string, kind: "visits" | "records" | "shares", body: object): Promise<void> {
  return fetch(`${API_URL}/api/games/${slug}/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: getSessionId(), ...body }),
    keepalive: true,
  }).then(
    () => undefined,
    () => undefined,
  );
}

export function recordGameVisit(slug: string) {
  return post(slug, "visits", {});
}

/** 공유 완료 1회 기록. native = 기기 공유 창, clipboard = 링크 복사 */
export function recordGameShare(slug: string, method: "native" | "clipboard") {
  return post(slug, "shares", { method });
}

/** 한 판 기록 적재. score는 그 게임의 순위 기준 값, data는 기록 객체 전체 */
export function submitGameRecord(slug: string, score: number, data: object) {
  return post(slug, "records", { score, data });
}
