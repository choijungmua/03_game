// 게임 이벤트(입장·한 판 기록·공유)를 백엔드(API_URL)로 한 번씩 보낸다. 저장은 백엔드가 맡는다. 실패해도 게임에는 영향 없음

import { fetchApi } from "@/lib/api-url";

const SESSION_KEY = "game-session-id";
/** 통계 전송은 서버가 꺼져 있어도 오래 매달리지 않게 짧게 끊는다 */
const EVENT_TIMEOUT_MS = 5000;
const startedAt = new Map<string, number>();
const completed = new Set<string>();

/** 브라우저 탭 단위 세션 id. 같은 탭에서의 입장·기록·방명록 글은 같은 id로 묶인다 */
export function getSessionId() {
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

function post(slug: string, kind: "visits" | "records" | "shares" | "sessions/finish" | "telemetry", body: object): Promise<void> {
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
  startedAt.set(slug, performance.now());
  completed.delete(slug);
  const query = new URLSearchParams(location.search);
  const userAgent = navigator.userAgent;
  const deviceClass = /Mobi|Android/i.test(userAgent) ? "mobile" : /Tablet|iPad/i.test(userAgent) ? "tablet" : "desktop";
  const browserFamily = /Edg/i.test(userAgent) ? "Edge" : /Firefox/i.test(userAgent) ? "Firefox" : /Chrome|CriOS/i.test(userAgent) ? "Chrome" : /Safari/i.test(userAgent) ? "Safari" : "Other";
  const osFamily = /Android/i.test(userAgent) ? "Android" : /iPhone|iPad/i.test(userAgent) ? "iOS" : /Windows/i.test(userAgent) ? "Windows" : /Mac OS/i.test(userAgent) ? "macOS" : /Linux/i.test(userAgent) ? "Linux" : "Other";
  let referrerDomain = "";
  try { referrerDomain = document.referrer ? new URL(document.referrer).hostname : ""; }
  catch (error) { if (!(error instanceof TypeError)) throw error; }
  return post(slug, "visits", {
    deviceClass, browserFamily, osFamily, language: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    landingPath: location.pathname, referrerDomain, utmSource: query.get("utm_source") ?? "",
    utmMedium: query.get("utm_medium") ?? "", utmCampaign: query.get("utm_campaign") ?? "",
  });
}

/** 공유 완료 1회 기록. native = 기기 공유 창, clipboard = 링크 복사 */
export function recordGameShare(slug: string, method: "native" | "clipboard") {
  return post(slug, "shares", { method });
}

/** 한 판 기록 적재. score는 그 게임의 순위 기준 값, data는 기록 객체 전체 */
export function submitGameRecord(slug: string, score: number, data: object) {
  const began = startedAt.get(slug) ?? performance.now();
  const durationSeconds = Math.max(0, (performance.now() - began) / 1000);
  startedAt.set(slug, performance.now());
  const clientBuild = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "development";
  completed.add(slug);
  const progress = ["stage", "level", "progress"].map((key) => Reflect.get(data, key)).find((value) => typeof value === "number" && Number.isFinite(value));
  const writes = [
    post(slug, "records", { score, data }),
    post(slug, "sessions/finish", { score, durationSeconds, clientBuild }),
    post(slug, "telemetry", { eventType: "score", value: score }),
    post(slug, "telemetry", { eventType: "game_complete", value: score, durationSeconds }),
  ];
  if (progress !== undefined) writes.push(post(slug, "telemetry", { eventType: "map_progress", value: progress }));
  return Promise.all(writes).then(() => undefined);
}

export function wasGameCompleted(slug: string) {
  return completed.has(slug);
}

export type TelemetryEvent =
  | "game_start" | "game_resume" | "game_quit" | "game_complete" | "score" | "ai_match"
  | "jump" | "slide" | "map_progress" | "distance_walked" | "outfit_change" | "glasses_change"
  | "onsen_visit" | "apple_pick" | "apple_eat" | "satiety_change" | "affection_change"
  | "sound_change" | "lamp_change";

export function recordGameTelemetry(
  slug: string,
  eventType: TelemetryEvent,
  detail: Readonly<Record<string, unknown>> = {},
): Promise<void> {
  return post(slug, "telemetry", { eventType, ...detail });
}
