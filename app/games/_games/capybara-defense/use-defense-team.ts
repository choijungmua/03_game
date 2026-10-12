"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  newerView,
  teamClient,
  type DefenseRoomView,
  type TeamCommand,
  type TeamSession,
} from "./team-client";

const STORAGE_KEY = "capybara-defense-survival-v1";
export function useDefenseTeam() {
  const [view, setView] = useState<DefenseRoomView | null>(null);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [session, setSession] = useState<TeamSession | null>(null);
  const sessionRef = useRef<TeamSession | null>(null);
  const generation = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const receive = useCallback((next: DefenseRoomView) => {
    setView((previous) => newerView(previous, next));
    setStatus("connected");
    setError(null);
  }, []);
  const report = useCallback((cause: unknown) => {
    setStatus("error");
    setError(
      cause instanceof Error
        ? cause.message
        : "연결이 끊겼어요. 다시 시도해 주세요.",
    );
  }, []);
  const remember = useCallback((next: TeamSession | null) => {
    sessionRef.current = next;
    setSession(next);
    try {
      if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(STORAGE_KEY);
      setStorageError(null);
    } catch (cause) {
      setStorageError(
        cause instanceof Error || cause instanceof DOMException
          ? "방 정보를 저장할 수 없어 새로고침하면 재접속할 수 없어요."
          : "브라우저 저장소를 사용할 수 없어요.",
      );
    }
  }, []);
  useEffect(
    () => () => {
      generation.current++;
      sessionRef.current = null;
    },
    [],
  );
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        const parsed: unknown = JSON.parse(saved);
        if (
          parsed &&
          typeof parsed === "object" &&
          "code" in parsed &&
          "token" in parsed &&
          typeof parsed.code === "string" &&
          /^[A-F0-9]{8}$/.test(parsed.code) &&
          typeof parsed.token === "string" &&
          /^[a-f0-9-]{36}$/.test(parsed.token)
        ) {
          const restored = { code: parsed.code, token: parsed.token };
          sessionRef.current = restored;
          setSession(restored);
          setStatus("connecting");
        } else remember(null);
      } catch (cause) {
        report(cause);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [remember, report]);
  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await teamClient.read(session);
        if (!stopped && sessionRef.current === session) receive(next);
      } catch (cause) {
        if (!stopped && sessionRef.current === session) report(cause);
      }
      if (!stopped) timer = setTimeout(poll, 250);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [session, receive, report]);
  const send = useCallback(
    (command: TeamCommand): Promise<void> => {
      const current = sessionRef.current;
      if (!current)
        return Promise.reject(new Error("먼저 방에 참여해 주세요."));
      const result = queue.current.then(async () => {
        if (sessionRef.current !== current) return;
        const next = await teamClient.send(current, command);
        if (sessionRef.current === current) receive(next);
      });
      queue.current = result.catch((cause) => {
        if (sessionRef.current === current) report(cause);
      });
      return result;
    },
    [receive, report],
  );
  useEffect(() => {
    const hidden = () => {
      if (document.hidden && view?.mode !== "survival" && view?.state.phase === "playing")
        void send({ type: "pause" }).catch(report);
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [send, report, view?.state.phase, view?.mode]);
  const connect = useCallback(
    async (code?: string) => {
      const operation = ++generation.current;
      setStatus("connecting");
      setError(null);
      try {
        const result = code
          ? await teamClient.join(code.trim().toUpperCase())
          : await teamClient.create();
        if (operation !== generation.current) return;
        receive(result.view);
        remember({ code: result.view.code, token: result.token });
      } catch (cause) {
        if (operation === generation.current) report(cause);
        throw cause;
      }
    },
    [receive, remember, report],
  );
  const leave = useCallback(async () => {
    const operation = ++generation.current;
    try {
      if (sessionRef.current) await send({ type: "leave" });
    } finally {
      if (operation === generation.current) {
        setView(null);
        setStatus("idle");
        remember(null);
      }
    }
  }, [remember, send]);
  return {
    view,
    status,
    error: error ?? storageError,
    inRoom: session !== null,
    create: () => connect(),
    join: (code: string) => connect(code),
    send,
    leave,
  };
}
