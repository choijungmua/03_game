/** 백엔드(04_game_b, NestJS) 주소. 운영은 https://api.ggpli.com, 로컬 PC에서는 4000 포트로 띄운다 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const OFFLINE_MESSAGE = "인터넷 연결이 끊겼어요. 연결되면 다시 시도해 주세요";
export const UNREACHABLE_MESSAGE = "게임 서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요";
export const TIMEOUT_MESSAGE = "게임 서버 응답이 늦어요. 잠시 후 다시 시도해 주세요";
export const SERVER_ERROR_MESSAGE = "게임 서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요";

const DEFAULT_TIMEOUT_MS = 8000;

/** 백엔드 요청 실패. status가 null이면 응답 자체를 받지 못한 경우(오프라인·연결 불가·시간 초과) */
export class ApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.status = status;
  }
}

/**
 * 백엔드 요청. 백엔드는 PC 한 대에서 돌아 언제든 꺼질 수 있으니 기다리는 시간에 상한을 두고,
 * 응답을 받지 못하면 브라우저의 영어 문구("Failed to fetch") 대신 한국어 ApiError를 던진다.
 * Cloudflare 오류 페이지(502·530)는 CORS 헤더가 없어 연결 불가와 같은 모양으로 온다
 */
export async function fetchApi(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new ApiError(OFFLINE_MESSAGE, null);
  const signal = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined;
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal });
  } catch (caught) {
    const timedOut = caught instanceof DOMException && caught.name === "TimeoutError";
    throw new ApiError(timedOut ? TIMEOUT_MESSAGE : UNREACHABLE_MESSAGE, null);
  }
}
