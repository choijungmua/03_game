// 게임 이벤트(입장·한 판 기록·공유)를 백엔드(API_URL)로 한 번씩 보낸다. 저장은 백엔드가 맡는다. 실패해도 게임에는 영향 없음

import { fetchApi } from "@/lib/api-url";

const SESSION_KEY = "game-session-id";
/** 통계 전송은 서버가 꺼져 있어도 오래 매달리지 않게 짧게 끊는다 */
const EVENT_TIMEOUT_MS = 5000;

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
  // 요청을 만드는 동안 난 동기 예외(crypto.randomUUID가 없는 HTTPS 아닌 주소 등)도 거부로 바꿔 삼킨다.
  // 부른 쪽(한 판 끝 finishRound)으로 던져지면 결과 화면으로 못 넘어가고 게임이 멈춘다
  return Promise.resolve().then(() =>
    fetchApi(
      `/api/games/${slug}/${kind}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getSessionId(), ...body }),
        keepalive: true,
      },
      EVENT_TIMEOUT_MS,
    ),
  ).then(
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
