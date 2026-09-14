"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

import { ApiError, fetchApi, SERVER_ERROR_MESSAGE } from "@/lib/api-url";
import { getSessionId } from "@/lib/games/game-events";

import { DEFAULT_NICKNAME, MESSAGE_MAX, NICKNAME_MAX } from "./constants";

export interface GuestbookEntry {
  id: number;
  nickname: string;
  message: string;
  createdAt: string;
}

const DATE_FORMAT = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

const FIELD =
  "w-full rounded-2xl border-4 border-capybara/60 bg-white/80 px-4 py-2 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:border-capybara focus-visible:outline-none";
const WOOD_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-full border-4 border-capybara bg-capybara-light px-5 text-sm font-bold text-capybara-dark shadow-md transition-[filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-capybara-dark disabled:opacity-60";

/** 응답을 못 받았으면 ApiError 문구, 받았으면 백엔드가 준 error 문구 */
async function request<T>(path: string, init?: RequestInit): Promise<Partial<T>> {
  const response = await fetchApi(path, init);
  let body: Partial<T & { error: string }> = {};
  try {
    body = await response.json();
  } catch {}
  if (!response.ok) throw new ApiError(typeof body.error === "string" ? body.error : SERVER_ERROR_MESSAGE, response.status);
  return body;
}

const errorText = (caught: Error | object) => (caught instanceof ApiError ? caught.message : SERVER_ERROR_MESSAGE);

/** 방명록: 위에 글쓰기, 아래에 최신 글 50개. 지우기·고치기는 없다 (문제 글은 문의 메일로) */
export function GuestbookBoard() {
  const [entries, setEntries] = useState<GuestbookEntry[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const load = () => {
    request<{ entries: GuestbookEntry[] }>("/api/guestbook").then(
      (body) => setEntries(Array.isArray(body.entries) ? body.entries : []),
      (caught: Error) => setLoadError(errorText(caught)),
    );
  };
  useEffect(load, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    const text = message.trim();
    if (!text) {
      setFormError("남길 말을 적어 주세요");
      messageRef.current?.focus();
      return;
    }
    const nickname = new FormData(event.currentTarget).get("nickname");
    setFormError("");
    setSending(true);
    try {
      const body = await request<{ entry: GuestbookEntry }>("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getSessionId(), nickname: typeof nickname === "string" ? nickname.trim() : "", message: text }),
      });
      const entry = body.entry;
      if (entry) setEntries((current) => [entry, ...(current ?? [])]);
      setMessage("");
    } catch (caught) {
      setFormError(errorText(caught instanceof Error ? caught : {}));
      messageRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <p className="text-center">로비에서 놀다 가셨나요? 한 줄 남겨 주세요.</p>

      <form onSubmit={submit} className="space-y-3" noValidate>
        <label className="block space-y-1">
          <span className="font-semibold text-foreground">닉네임 (선택)</span>
          <input name="nickname" autoComplete="nickname" maxLength={NICKNAME_MAX} placeholder={`${DEFAULT_NICKNAME}…`} className={FIELD} />
        </label>
        <label className="block space-y-1">
          <span className="font-semibold text-foreground">남길 말</span>
          <textarea
            ref={messageRef}
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) event.currentTarget.form?.requestSubmit();
            }}
            maxLength={MESSAGE_MAX}
            rows={3}
            placeholder="카피바라 귀여워요…"
            aria-invalid={formError ? true : undefined}
            aria-describedby="guestbook-form-status"
            className={`${FIELD} resize-none`}
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <p id="guestbook-form-status" aria-live="polite" className="min-w-0 text-xs">
            {formError ? <span className="font-semibold text-destructive">{formError}</span> : <span className="tabular-nums">{`${[...message].length}/${MESSAGE_MAX}`}</span>}
          </p>
          <button type="submit" disabled={sending} className={WOOD_BUTTON}>
            {sending ? "남기는 중…" : "남기기"}
          </button>
        </div>
      </form>

      <section className="space-y-3" aria-busy={entries === null && !loadError}>
        <h2 className="text-base font-semibold text-foreground">남겨진 글</h2>
        {loadError ? (
          <div className="flex flex-col items-center gap-3 text-center" role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setLoadError("");
                load();
              }}
              className={WOOD_BUTTON}
            >
              다시 불러오기
            </button>
          </div>
        ) : entries === null ? (
          <p className="text-center">불러오는 중…</p>
        ) : entries.length === 0 ? (
          <p className="text-center">아직 글이 없어요. 첫 글을 남겨 주세요!</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-2xl bg-white/70 px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-bold text-foreground">{entry.nickname}</span>
                  <time dateTime={entry.createdAt} className="shrink-0 text-xs tabular-nums">
                    {DATE_FORMAT.format(new Date(entry.createdAt))}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words">{entry.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
