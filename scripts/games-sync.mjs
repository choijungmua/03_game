import { pathToFileURL } from "node:url";

import { readRegistry } from "./seo/common.ts";

// Only add missing slugs: existing IDs, titles, counters, and retired games stay intact.
export async function syncGames({ origin, key, games, apply = false }, request = fetch) {
  const url = new URL("/rest/v1/g_game", origin);
  if (url.protocol !== "https:" || !key || games.length === 0) {
    throw new Error("HTTPS Supabase URL, server secret, and nonempty registry required");
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  url.searchParams.set("select", "id,slug");
  const response = await request(url, { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Registry read failed: HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.some(row => !Number.isSafeInteger(row.id) || typeof row.slug !== "string")) {
    throw new Error("Invalid game registry response");
  }
  const present = new Set(rows.map(row => row.slug));
  const missing = games.filter(game => !present.has(game.slug)).map(({ slug, title }) => ({ slug, title }));
  if (apply && missing.length > 0) {
    url.search = "";
    url.searchParams.set("on_conflict", "slug");
    const result = await request(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(missing),
      signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) throw new Error(`Registry insert failed: HTTP ${result.status}`);
  }
  return missing;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--apply")) throw new Error("Usage: games-sync.mjs [--apply]");
  const apply = args.includes("--apply");
  const missing = await syncGames({
    origin: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY,
    games: await readRegistry(),
    apply,
  });
  console.log(JSON.stringify({ mode: apply ? "apply" : "check", missing }, null, 2));
  if (!apply && missing.length > 0) process.exitCode = 1;
}
