import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { API_URL } from "@/lib/api-url";

import type { RoomAction, RoomResult, RoomState, Vector } from "./rooms";

type RoomSuccess<S> = Extract<RoomResult<S>, { ok: true }>;

const POLL_MS = 1000;
/** 어느 차례든 보낼 수 있는 행동. 나머지는 보내기 전에 서버 기준으로 내 차례인지 확인한다 */
const ANY_TURN_ACTIONS = ["resign"];

function loadToken(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveToken(key: string, token: string) {
  try {
    sessionStorage.setItem(key, token);
  } catch {}
}

async function callApi<S>(path: string, body?: RoomAction | { bot?: boolean }): Promise<RoomSuccess<S>> {
  const response = await fetch(
    path,
    body
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : { cache: "no-store" },
  );
  const data: Partial<RoomSuccess<S> & { error: string }> = await response.json().catch(() => ({}));
  if (!response.ok || !data.view) throw new Error(data.error ?? "서버와 연결하지 못했어요");
  return { ok: true, view: data.view, token: data.token ?? null };
}

// 폴링 응답과 수 두기 응답은 보낸 순서와 다르게 도착할 수 있다.
// 수를 두기 전에 나간 폴링이 늦게 오면 판이 한 수 전으로 되돌아가 깜빡이므로, 같은 방의 더 오래된 버전은 버린다 (서버 시각만 새 값으로)
function newer<S>(current: RoomSuccess<S> | undefined, next: RoomSuccess<S>): RoomSuccess<S> {
  if (!current || current.view.code !== next.view.code || next.view.version >= current.view.version) return next;
  return { ...current, view: { ...current.view, now: next.view.now } };
}

/** 초대 코드 온라인 대전 클라이언트: 방 만들기·참가·수 두기·1초 폴링. 서버는 백엔드의 /api/games/<slug>/rooms */
export function useRoom<S extends RoomState, A extends string>(slug: string) {
  const api = `${API_URL}/api/games/${slug}/rooms`;
  const queryClient = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const joinedFromUrl = useRef(false);

  const keyOf = (roomCode: string | null) => ["room", slug, roomCode];
  const receive = (result: RoomSuccess<S>) =>
    queryClient.setQueryData<RoomSuccess<S>>(keyOf(result.view.code), (current) => newer(current, result));

  // ponytail: 1초 폴링으로 상대 수를 받는다 — 동시 대국이 많아지면 SSE/WebSocket으로 교체
  // 응답이 느려도 요청이 겹치지 않고, 끝난 판은 멈추며, 다른 탭을 보다 돌아오면 바로 다시 받는다(refetchOnWindowFocus)
  const room = useQuery({
    queryKey: keyOf(code),
    queryFn: async () => {
      const result = await callApi<S>(`${api}/${code}${token ? `?token=${encodeURIComponent(token)}` : ""}`);
      return newer(queryClient.getQueryData<RoomSuccess<S>>(keyOf(code)), result);
    },
    enabled: code !== null,
    retry: false,
    refetchInterval: (query) => (query.state.data?.view.state.endReason ? false : POLL_MS),
  });
  const view = room.data?.view ?? null;

  const action = useMutation({
    mutationFn: (task: () => Promise<RoomSuccess<S>>) => task(),
    onMutate: () => setError(""),
    onError: (caught) => setError(caught.message),
    onSuccess: (result) => {
      if (result.token) {
        saveToken(`${slug}:${result.view.code}`, result.token);
        setToken(result.token);
      }
      receive(result);
      setCode(result.view.code);
      window.history.replaceState(null, "", `?code=${result.view.code}`);
    },
  });
  const run = action.mutate;

  /** bot이면 컴퓨터(백)와 두는 방 */
  function create(bot = false) {
    run(() => callApi<S>(api, bot ? { bot: true } : {}));
  }

  function join(rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      setError("초대 코드를 입력해 주세요");
      return;
    }
    run(() => callApi<S>(`${api}/${code}`, { type: "join", token: loadToken(`${slug}:${code}`) ?? undefined }));
  }

  // 초대 링크(?code=)로 들어오면 바로 참가. 새로고침해도 sessionStorage 토큰으로 같은 자리에 돌아온다
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
    if (!view || !token) return;
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

  // 이모티콘은 판을 잠그지 않게(pending 없이) 따로 보낸다
  function sendEmote(id: number) {
    if (!view || !token) return;
    callApi<S>(`${api}/${view.code}`, { type: "emote", index: id, token }).then(receive, (caught) =>
      setError(caught instanceof Error ? caught.message : "이모티콘을 보내지 못했어요"),
    );
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
    setCode(null);
    setToken(null);
    setError("");
    setCopied(false);
    window.history.replaceState(null, "", window.location.pathname);
  }

  return {
    view,
    error: error || (room.error?.message ?? ""),
    pending: action.isPending,
    copied,
    /** 서버 시각 - 내 시각(ms). 남은 시간을 서버 기준으로 세는 데 쓴다 */
    clockOffset: view ? view.now - room.dataUpdatedAt : 0,
    create,
    join,
    act,
    sendEmote,
    copyInvite,
    leave,
    setError,
  };
}

/** 게임 공용 화면에 넘기는 방 핸들. 행동(act)은 게임마다 이름이 달라서 빼고 콜백으로 받는다 */
export type RoomHandle<S extends RoomState> = Omit<ReturnType<typeof useRoom<S, string>>, "act">;
