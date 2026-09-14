"use client";

import { useEffect } from "react";

const SESSION_KEY = "visit-session-id";

// 브라우저 탭 단위 세션 id. 같은 탭에서 여러 게임에 들어가면 같은 id로 묶인다
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

// 게임 입장 1회 기록 (Supabase RPC record_game_visit). 실패해도 게임에는 영향 없음
export function recordGameVisit(slug: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Promise.resolve();

  return fetch(`${url}/rest/v1/rpc/record_game_visit`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: slug, p_session_id: getSessionId() }),
    keepalive: true,
  }).then(
    () => undefined,
    () => undefined,
  );
}

export function GameVisitTracker({ slug }: { slug: string }) {
  useEffect(() => {
    void recordGameVisit(slug);
  }, [slug]);
  return null;
}
