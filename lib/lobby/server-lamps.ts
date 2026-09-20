import { ApiError, fetchApi, SERVER_ERROR_MESSAGE } from "@/lib/api-url";

const LAMP_KEY = /^-?\d+,-?\d+$/;
export type LampState = Readonly<Record<string, boolean>>;

function parseLampState(raw: unknown): LampState | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const state: Record<string, boolean> = {};
  for (const [key, isOn] of Object.entries(raw)) {
    if (!LAMP_KEY.test(key) || typeof isOn !== "boolean") return null;
    state[key] = isOn;
  }
  return state;
}

export async function syncLamps(key?: string, isOn?: boolean): Promise<LampState> {
  const response = await fetchApi("/api/lobby/lamps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(key === undefined ? {} : { key, isOn }),
  });
  if (!response.ok) throw new ApiError(SERVER_ERROR_MESSAGE, response.status);
  const state = parseLampState(await response.json());
  if (!state) throw new ApiError(SERVER_ERROR_MESSAGE, response.status);
  return state;
}
