// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { syncLamps } from "./server-lamps";

afterEach(() => vi.unstubAllGlobals());

describe("server lamps", () => {
  it("서버의 전체 램프 상태를 읽고 변경 요청을 보낸다", async () => {
    const fetch = vi.fn(async () => Response.json({ "1,2": false, "-3,4": true }));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("navigator", { onLine: true });
    await expect(syncLamps("1,2", false)).resolves.toEqual({ "1,2": false, "-3,4": true });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/lobby/lamps"),
      expect.objectContaining({ body: JSON.stringify({ key: "1,2", isOn: false }) }),
    );
  });
});
