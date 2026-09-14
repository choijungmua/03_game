import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { GameEntry, GameSeo } from "../../lib/games/types.ts";

export const ROOT = process.cwd();

export type RegistryGame = Pick<GameEntry, "slug" | "title" | "description">;

export interface KeywordStat {
  keyword: string;
  /** 네이버 월간 검색수(PC + 모바일). 10 미만("< 10")은 5로 센다 */
  monthlySearches: number;
  /** 네이버 광고 경쟁 정도: 낮음·중간·높음 */
  competition: string;
  /** 최근 4주 검색량 ÷ 그 전 12주 평균. 1보다 크면 오르는 중. 데이터랩 키가 없으면 null */
  trend: number | null;
}

export interface KeywordReport {
  /** YYYY-MM-DD */
  fetchedAt: string;
  seeds: string[];
  keywords: KeywordStat[];
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function gameDir(slug: string) {
  return join(ROOT, "app/games/_games", slug);
}

/** 한국 시간 기준 오늘 YYYY-MM-DD */
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

// ponytail: registry.ts는 next/dynamic을 불러 Node에서 import할 수 없어 정규식으로 읽는다. 항목의 slug·title·description 순서가 바뀌면 같이 고칠 것
export async function readRegistry(): Promise<RegistryGame[]> {
  const source = await readFile(join(ROOT, "lib/games/registry.ts"), "utf8");
  const titles = await loadGameTitles();
  const entries = source.matchAll(
    /slug: "([^"]+)",\s*title: (?:"([^"]+)"|GAME_TITLES\[[^\]]+\]),\s*description: "([^"]+)"/g,
  );
  return [...entries].map(([, slug, title, description]) => ({
    slug,
    title: title ?? titles[slug] ?? slug,
    description,
  }));
}

/** 레지스트리가 제목을 lib/games/constants.ts의 GAME_TITLES에서 꺼내 쓰는 경우 */
async function loadGameTitles(): Promise<Record<string, string>> {
  const file = join(ROOT, "lib/games/constants.ts");
  if (!existsSync(file)) return {};
  const loaded: Partial<{ GAME_TITLES: Record<string, string> }> = await import(pathToFileURL(file).href);
  return loaded.GAME_TITLES ?? {};
}

/** 명령줄의 slug 목록을 게임으로 바꾼다. --all·--missing·--stale이면 등록된 게임 전부 */
export async function resolveGames(args: string[]) {
  const games = await readRegistry();
  if (args.some((arg) => ["--all", "--missing", "--stale"].includes(arg))) return games;

  const slugs = args.filter((arg) => !arg.startsWith("--"));
  const unknown = slugs.filter((slug) => !games.some((game) => game.slug === slug));
  if (unknown.length > 0) fail(`registry에 없는 slug: ${unknown.join(", ")}`);
  if (slugs.length === 0) fail("게임 slug를 적거나 --all을 붙여 주세요. 예) reaction-time click-speed");
  return games.filter((game) => slugs.includes(game.slug));
}

/** 게임 폴더의 seo.ts. `import type`은 Node가 지우므로 그대로 불러올 수 있다 */
export async function loadSeo(slug: string): Promise<GameSeo | null> {
  const file = join(gameDir(slug), "seo.ts");
  if (!existsSync(file)) return null;
  const loaded: Partial<{ seo: GameSeo }> = await import(pathToFileURL(file).href);
  return loaded.seo ?? null;
}

/** pnpm seo:keywords가 남긴 seo-keywords.json */
export async function loadKeywordReport(slug: string): Promise<KeywordReport | null> {
  const file = join(gameDir(slug), "seo-keywords.json");
  if (!existsSync(file)) return null;
  const raw: Partial<KeywordReport> = JSON.parse(await readFile(file, "utf8"));
  if (typeof raw.fetchedAt !== "string" || !Array.isArray(raw.seeds) || !Array.isArray(raw.keywords)) return null;
  return { fetchedAt: raw.fetchedAt, seeds: raw.seeds, keywords: raw.keywords };
}
