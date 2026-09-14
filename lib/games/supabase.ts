// 브라우저 -> Supabase RPC (게임 입장 수·한 판 기록 적재). 실패해도 게임에는 영향 없음

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

function callRpc(name: string, args: object): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Promise.resolve();

  return fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    keepalive: true,
  }).then(
    () => undefined,
    () => undefined,
  );
}

export function recordGameVisit(slug: string) {
  return callRpc("record_game_visit", { p_slug: slug, p_session_id: getSessionId() });
}

/** 공유 완료 1회 기록. native = 기기 공유 창, clipboard = 링크 복사 */
export function recordGameShare(slug: string, method: "native" | "clipboard") {
  return callRpc("record_game_share", { p_slug: slug, p_session_id: getSessionId(), p_method: method });
}

/** 한 판 기록 적재. score는 그 게임의 순위 기준 값, data는 기록 객체 전체 */
export function submitGameRecord(slug: string, score: number, data: object) {
  return callRpc("submit_game_record", {
    p_slug: slug,
    p_session_id: getSessionId(),
    p_score: score,
    p_data: data,
  });
}
