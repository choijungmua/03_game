import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { ApiError, fetchApi, SERVER_ERROR_MESSAGE } from "@/lib/api-url";

import type { BotLevel, RoomAction, RoomResult, RoomState, RoomSummary, Vector } from "./rooms";

type RoomSuccess<S> = Extract<RoomResult<S>, { ok: true }>;
type RoomFailure<S> = Extract<RoomResult<S>, { ok: false }>;
/** 응답 본문은 성공·실패 어느 쪽 필드든 올 수 있다 (ok는 둘이 충돌해서 뺀다) */
type RoomBody<S> = Partial<Omit<RoomSuccess<S>, "ok"> & Omit<RoomFailure<S>, "ok">>;

const POLL_MS = 1000;
/** 폴링이 실패하면 1→2→4→8→10초로 늘려서 꺼진 서버를 1초마다 두드리지 않는다 */
const MAX_POLL_MS = 10_000;
/** 어느 차례든 보낼 수 있는 행동. 나머지는 보내기 전에 서버 기준으로 내 차례인지 확인한다 */
const ANY_TURN_ACTIONS = ["resign"];

// 토큰은 localStorage에 둔다 — 같은 브라우저의 다른 탭에서 초대 링크를 열어도 같은 자리로 돌아온다
// (탭마다 따로인 sessionStorage면 방장이 새 탭에서 자기 방의 백 자리를 차지해 혼자 두게 된다)
function loadToken(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveToken(key: string, token: string) {
  try {
    localStorage.setItem(key, token);
  } catch {}
}

async function callApi<S>(path: string, body?: RoomAction | { bot?: boolean; level?: BotLevel }): Promise<RoomSuccess<S>> {
  const response = await fetchApi(
    path,
    body
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : { cache: "no-store" },
  );
  const data: RoomBody<S> = await response.json().catch(() => ({}));
  if (response.ok && data.view) return { ok: true, view: data.view, token: data.token ?? null };

  // 백엔드는 실패 본문에 status를 같이 넣는다. 본문을 못 읽었으면(HTML 오류 페이지 등) HTTP 상태로 판단한다
  const status = typeof data.status === "number" ? data.status : response.status;
  const fallback = !status || status >= 500 ? SERVER_ERROR_MESSAGE : "요청을 처리하지 못했어요. 다시 시도해 주세요";
  throw new ApiError(data.error ?? fallback, status || null);
}

/** 방이 서버에서 사라짐(만료·삭제). 이때는 다시 시도해도 소용없다 */
function isGone(error: Error | null) {
  return error instanceof ApiError && error.status === 404;
}

/** 서버 시각 차이가 이만큼 넘게 달라졌을 때만 바꾼다 (남은 시간 표시가 250ms마다 갱신된다) */
const CLOCK_JITTER_MS = 250;

// 폴링 응답과 수 두기 응답은 보낸 순서와 다르게 도착할 수 있다.
// 수를 두기 전에 나간 폴링이 늦게 오면 판이 한 수 전으로 되돌아가 깜빡이므로 같은 방의 더 오래된 버전은 버리고,
// 같은 버전이면 원래 객체를 그대로 둔다 (1초 폴링마다 새 객체가 되면 판 전체가 매초 다시 그려진다)
function newer<S>(current: RoomSuccess<S> | undefined, next: RoomSuccess<S>): RoomSuccess<S> {
  if (!current || current.view.code !== next.view.code || next.view.version > current.view.version) return next;
  return current;
}

/** 초대 코드 온라인 대전 클라이언트: 방 만들기·참가·관전·수 두기·폴링. 서버는 백엔드의 /api/games/<slug>/rooms */
export function useRoom<S extends RoomState, A extends string>(slug: string) {
  const api = `/api/games/${slug}/rooms`;
  const queryClient = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  /** 두 명이 이미 들어가 참가하지 못한 방 코드. 있으면 관전하기를 보여준다 */
  const [spectateCode, setSpectateCode] = useState<string | null>(null);
  const joinedFromUrl = useRef(false);
  /** 서버 시각 - 내 시각(ms). 응답마다 몇 ms씩 흔들리므로 CLOCK_JITTER_MS 넘게 달라질 때만 바꿔 다시 그리지 않는다 */
  const [clockOffset, setClockOffset] = useState(0);
  /** 연속으로 실패한 폴링 수 (성공하면 0) */
  const failures = useRef(0);
  const emoteSending = useRef(false);

  const keyOf = (roomCode: string | null) => ["room", slug, roomCode];
  const syncClock = (result: RoomSuccess<S>) => {
    const offset = result.view.now - Date.now();
    setClockOffset((current) => (Math.abs(current - offset) > CLOCK_JITTER_MS ? offset : current));
  };
  const receive = (result: RoomSuccess<S>) => {
    syncClock(result);
    queryClient.setQueryData<RoomSuccess<S>>(keyOf(result.view.code), (current) => newer(current, result));
  };

  // ponytail: 폴링으로 상대 수를 받는다 — 동시 대국이 많아지면 SSE/WebSocket으로 교체
  // 응답이 느려도 요청이 겹치지 않고, 끝난 판·사라진 방은 멈추며, 다른 탭을 보다 돌아오면 바로 다시 받는다(refetchOnWindowFocus)
  const room = useQuery({
    queryKey: keyOf(code),
    queryFn: async () => {
      try {
        const result = await callApi<S>(`${api}/${code}${token ? `?token=${encodeURIComponent(token)}` : ""}`);
        // 연결이 돌아오면 끊겼을 때 남은 에러 줄을 지운다
        if (failures.current > 0) setError("");
        failures.current = 0;
        syncClock(result);
        return newer(queryClient.getQueryData<RoomSuccess<S>>(keyOf(code)), result);
      } catch (caught) {
        failures.current += 1;
        throw caught;
      }
    },
    enabled: code !== null,
    retry: false,
    // 오프라인이어도 멈춰 기다리지 않고 바로 실패시켜 알린다 (멈췄다가 나중에 보내면 옛날 화면 기준 요청이 나간다)
    networkMode: "always",
    refetchInterval: (query) => {
      if (query.state.data?.view.state.endReason || isGone(query.state.error)) return false;
      return Math.min(POLL_MS * 2 ** failures.current, MAX_POLL_MS);
    },
  });
  const view = room.data?.view ?? null;
  const gone = view !== null && isGone(room.error);
  const reconnecting = view !== null && room.isError && !gone;

  const action = useMutation({
    mutationFn: (task: () => Promise<RoomSuccess<S>>) => task(),
    networkMode: "always",
    onMutate: () => setError(""),
    onError: (caught) => setError(caught.message),
    onSuccess: (result) => {
      if (result.token) {
        saveToken(`${slug}:${result.view.code}`, result.token);
        setToken(result.token);
      }
      failures.current = 0;
      receive(result);
      setCode(result.view.code);
      window.history.replaceState(null, "", `?code=${result.view.code}`);
    },
  });
  const run = action.mutate;

  /** level을 주면 그 수준의 컴퓨터(백)와 두는 방, 없으면 친구 방 */
  function create(level?: BotLevel) {
    setSpectateCode(null);
    run(() => callApi<S>(api, level ? { bot: true, level } : {}));
  }

  function join(rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      setError("초대 코드를 입력해 주세요");
      return;
    }
    setSpectateCode(null);
    run(() =>
      callApi<S>(`${api}/${code}`, { type: "join", token: loadToken(`${slug}:${code}`) ?? undefined }).catch((caught) => {
        // 두 명이 이미 들어간 방(409)은 관전으로 볼 수 있게 한다
        if (caught instanceof ApiError && caught.status === 409) setSpectateCode(code);
        throw caught;
      }),
    );
  }

  /** 관전: 토큰 없이 방을 읽기만 한다 */
  function watch() {
    if (!spectateCode) return;
    failures.current = 0;
    setToken(null);
    setError("");
    setCode(spectateCode);
    setSpectateCode(null);
    window.history.replaceState(null, "", `?code=${spectateCode}`);
  }

  // 초대 링크(?code=)로 들어오면 바로 참가. 새로고침해도 저장해 둔 토큰으로 같은 자리에 돌아온다
  const joinFromUrl = useEffectEvent(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) join(code);
  });

  useEffect(() => {
    if (joinedFromUrl.current) return;
    joinedFromUrl.current = true;
    joinFromUrl();
  }, []);

  function act(type: A, index?: number, aim?: Vector) {
    // 보내는 중에 또 누르면 같은 수가 두 번 나가 409 에러 줄이 생긴다
    if (!view || !token || action.isPending) return;
    const { you, state } = view;
    const path = `${api}/${view.code}`;
    run(async () => {
      // 내 화면의 차례 정보는 폴링 간격만큼 늦을 수 있다. 상대 차례로 보이면 보내기 전에 서버에서 다시 확인하고,
      // 정말 상대 차례면 보내지 않고 화면만 최신으로 맞춘다 (보내면 409 에러 줄이 생겨 판이 밀린다)
      if (!ANY_TURN_ACTIONS.includes(type) && you !== state.turn) {
        const latest = await callApi<S>(`${path}?token=${encodeURIComponent(token)}`);
        if (latest.view.you !== latest.view.state.turn) return latest;
      }
      return callApi<S>(path, { type, index, aim, token });
    });
  }

  // 이모티콘은 판을 잠그지 않게(pending 없이) 따로 보낸다. 보내는 중 연타는 무시한다
  function sendEmote(id: number) {
    if (!view || !token || emoteSending.current) return;
    emoteSending.current = true;
    callApi<S>(`${api}/${view.code}`, { type: "emote", index: id, token })
      .then(receive, (caught) => setError(caught instanceof Error ? caught.message : "이모티콘을 보내지 못했어요"))
      .finally(() => {
        emoteSending.current = false;
      });
  }

  function copyInvite() {
    if (!view) return;
    const link = `${window.location.origin}${window.location.pathname}?code=${view.code}`;
    navigator.clipboard.writeText(link).then(
      () => setCopied(true),
      () => setError("복사하지 못했어요. 코드를 직접 알려주세요"),
    );
  }

  function leave() {
    failures.current = 0;
    setCode(null);
    setToken(null);
    setError("");
    setCopied(false);
    setSpectateCode(null);
    window.history.replaceState(null, "", window.location.pathname);
  }

  // 사라진 방은 아래 안내 창이 알리므로 에러 줄은 비운다. 연결이 끊긴 동안에는 다시 붙는 중임을 덧붙인다
  const pollError = room.error && !gone ? `${room.error.message} (다시 연결하는 중…)` : "";

  return {
    slug,
    view,
    error: error || pollError,
    pending: action.isPending,
    /** 폴링이 실패하는 중 — 판 입력을 막는다 */
    reconnecting,
    /** 대국 중 방이 서버에서 사라짐 */
    gone,
    spectateCode,
    copied,
    /** 서버 시각 - 내 시각(ms). 남은 시간을 서버 기준으로 세는 데 쓴다 */
    clockOffset,
    create,
    join,
    watch,
    act,
    sendEmote,
    copyInvite,
    leave,
    setError,
  };
}

/** 방 목록(기다리는 방·게임 중인 방). 쓰는 화면이 떠 있는 동안 3초마다, 서버가 응답하지 않으면 10초마다 새로 받는다 */
export function useRoomList(slug: string) {
  const rooms = useQuery({
    queryKey: ["room-list", slug],
    queryFn: async () => {
      const response = await fetchApi(`/api/games/${slug}/rooms`, { cache: "no-store" });
      const data: Partial<{ rooms: Partial<RoomSummary>[] }> = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.rooms)) throw new ApiError(SERVER_ERROR_MESSAGE, response.status || null);
      // 서버가 프론트보다 옛 버전이면 status가 없다(그땐 기다리는 방만 내려줬다). 모르는 상태로 ROOM_STATUS[status] 조회가
      // 깨져 목록 화면이 통째로 죽지 않게 여기서 확정 타입으로 좁힌다. 꽉 찬 방을 대기로 잘못 봐도 참가 시 409 → 관전으로 넘어간다
      return data.rooms.flatMap(({ code, status }): RoomSummary[] =>
        typeof code === "string" ? [{ code, status: status === "playing" ? "playing" : "waiting" }] : [],
      );
    },
    retry: false,
    networkMode: "always",
    refetchInterval: (query) => (query.state.status === "error" ? MAX_POLL_MS : POLL_MS * 3),
  });
  // 못 받았을 때 "열린 방이 없어요"로 보이면 헷갈리니 실패를 따로 알린다 (전에 받은 목록은 그대로 둔다)
  return { rooms: rooms.data ?? [], failed: rooms.isError };
}

/** 게임 공용 화면에 넘기는 방 핸들. 행동(act)은 게임마다 이름이 달라서 빼고 콜백으로 받는다 */
export type RoomHandle<S extends RoomState> = Omit<ReturnType<typeof useRoom<S, string>>, "act">;
