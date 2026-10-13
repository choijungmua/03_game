import { describe, expect, it, vi } from "vitest";

import { syncGames } from "./games-sync.mjs";

const options = {
  origin: "https://example.supabase.co",
  key: "test-secret",
  games: [{ slug: "existing", title: "Existing" }, { slug: "new-game", title: "New" }],
};

describe("game registry sync", () => {
  it("reports missing games without writing by default", async () => {
    const request = vi.fn().mockResolvedValue(Response.json([{ id: 1, slug: "existing" }]));
    expect(await syncGames(options, request)).toEqual([{ slug: "new-game", title: "New" }]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("inserts only missing games and ignores concurrent duplicates", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json([{ id: 1, slug: "existing" }]))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    await syncGames({ ...options, apply: true }, request);
    const [url, init] = request.mock.calls[1];
    expect(url.searchParams.get("on_conflict")).toBe("slug");
    expect(init.headers.Prefer).toContain("resolution=ignore-duplicates");
    expect(JSON.parse(init.body)).toEqual([{ slug: "new-game", title: "New" }]);
  });

  it("does not write when every current game is registered", async () => {
    const request = vi.fn().mockResolvedValue(Response.json([{ id: 1, slug: "existing" }, { id: 2, slug: "new-game" }]));
    expect(await syncGames({ ...options, apply: true }, request)).toEqual([]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("stops on denied reads or failed inserts without claiming success", async () => {
    const denied = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    await expect(syncGames({ ...options, apply: true }, denied)).rejects.toThrow("HTTP 403");
    expect(denied).toHaveBeenCalledTimes(1);
    const failed = vi.fn().mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(syncGames({ ...options, apply: true }, failed)).rejects.toThrow("HTTP 500");
  });
});
