// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { syncApples } from "./server-apples";

const PROFILE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOKEN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("server apples", () => {
  it("전역 나무 수와 개인 가방 응답을 안전하게 읽는다", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ trees: [1, 0, 3], lastCatch: "사과", caughtCount: 2, inventory: { 사과: 2, 상어: 9 } }),
      ),
    );
    await expect(syncApples(PROFILE, TOKEN, "pick", 0)).resolves.toEqual({
      trees: [1, 0, 3],
      lastCatch: "사과",
      caughtCount: 2,
      inventory: { 사과: 2 },
    });
  });
});
