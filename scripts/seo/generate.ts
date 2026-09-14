/**
 * 게임별 SEO 문구 생성 (Claude API)
 *   pnpm seo:generate <slug...>   지정한 게임
 *   pnpm seo:generate --missing   seo.ts가 없는 게임
 *   pnpm seo:generate --stale     새 검색어 트렌드와 지금 문구의 검색어가 많이 어긋난 게임
 *   pnpm seo:generate --all       전부
 *
 * 게임 소스 코드(규칙·조작·수치의 근거)와 seo-keywords.json(검색어 트렌드)을 넣어
 * 게임 폴더의 seo.ts를 새로 쓴다. 결과는 반드시 사람이 검토하고 pnpm test로 확인한다.
 */
import { existsSync, statSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import Anthropic from "@anthropic-ai/sdk";

import type { GameSeo } from "../../lib/games/types.ts";
import {
  fail,
  gameDir,
  loadKeywordReport,
  loadSeo,
  readRegistry,
  type RegistryGame,
  resolveGames,
  ROOT,
  today,
} from "./common.ts";

type GeneratedSeo = Omit<GameSeo, "updatedAt">;

const MODEL = "claude-opus-5";

const stringList = { type: "array", items: { type: "string" } };
const SEO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["metaTitle", "metaDescription", "guideDescription", "keywords", "intro", "howToPlay", "tips", "faq", "guide"],
  properties: {
    metaTitle: { type: "string" },
    metaDescription: { type: "string" },
    guideDescription: { type: "string" },
    keywords: stringList,
    intro: { type: "string" },
    howToPlay: stringList,
    tips: stringList,
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer"],
        properties: { question: { type: "string" }, answer: { type: "string" } },
      },
    },
    guide: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "body"],
        properties: { heading: { type: "string" }, body: { type: "string" } },
      },
    },
  },
};

const SYSTEM_PROMPT = `너는 한국어 무료 웹게임 사이트 ggpli의 SEO 에디터다. 게임 하나의 검색 노출용 문구를 JSON으로 쓴다.

원칙
- 사실만 쓴다. 조작법·규칙·등급·수치·기능은 함께 준 게임 소스 코드에서 확인한 것만 쓴다. 코드에 없는 기능(사운드, 로그인, 서버 랭킹, 컴퓨터 대전 등)은 지어내지 않는다.
- 사람이 읽는 글이다. 이 게임을 하려는 사람이 궁금해할 내용을 자연스러운 한국어로 쓰고, 검색어를 억지로 반복하지 않는다. 구글은 가치 없이 대량 생성한 페이지를 스팸으로 본다.
- 이미 있는 다른 게임 문구와 표현·문장 구조가 겹치지 않게 쓴다.
- 검색어 트렌드 데이터가 있으면, 월간 검색수가 많거나 trend가 1보다 큰 검색어 중 이 게임과 정말 관련 있는 것만 keywords와 본문에 녹인다. 관련 없는 인기 검색어는 넣지 않는다.
- 사이트 이름(ggpli)은 넣지 않는다. 제목 템플릿이 붙인다.

필드
- metaTitle: 40자 이내. "게임 이름 - 핵심 검색어" 모양.
- metaDescription: 80~150자. 무엇을 하는 게임인지와 이 게임만의 특징.
- guideDescription: 80~150자. 가이드 페이지에서 알 수 있는 내용(규칙·등급·공략). metaDescription과 다른 문장.
- keywords: 8~12개, 중복 없이. 첫 번째는 게임 이름 그대로, 이어서 대표 검색어, 연관·롱테일 검색어.
- intro: 2~3문장, 100~250자.
- howToPlay: 4~6단계. 한 단계에 한 동작.
- tips: 3~5개. 코드 수치에 근거한 실전 요령.
- faq: 4~5개. 실제로 검색할 법한 질문과 1~3문장 답.
- guide: 3~5개 섹션. heading은 검색어가 자연스럽게 들어간 소제목, body는 2~4문장.`;

function isSource(file: string) {
  return /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && !/(^|[\\/])seo\.ts$/.test(file);
}

async function listSources(dir: string) {
  return (await readdir(dir, { recursive: true })).filter(isSource).map((file) => join(dir, file));
}

/** 게임 폴더 코드와, 거기서 불러오는 게임 공용 모듈(components/games·lib/games)을 한 단계까지 모은다 */
async function readSources(slug: string) {
  const files = new Set(await listSources(gameDir(slug)));
  for (const file of [...files]) {
    for (const [, path] of (await readFile(file, "utf8")).matchAll(/from "@\/((?:components|lib)\/games\/[^"]+)"/g)) {
      const base = join(ROOT, path);
      if (existsSync(base) && statSync(base).isDirectory()) {
        (await listSources(base)).forEach((shared) => files.add(shared));
        continue;
      }
      const match = [`${base}.ts`, `${base}.tsx`].find((candidate) => existsSync(candidate));
      if (match) files.add(match);
    }
  }

  const parts = await Promise.all(
    [...files].map(async (file) => `// ${relative(ROOT, file)}\n${await readFile(file, "utf8")}`),
  );
  return parts.join("\n\n");
}

async function otherGamesSummary(games: RegistryGame[], slug: string) {
  const lines: string[] = [];
  for (const game of games) {
    if (game.slug === slug) continue;
    const seo = await loadSeo(game.slug);
    if (seo) lines.push(`- ${game.title}: ${seo.metaTitle} / ${seo.intro}`);
  }
  return lines.length > 0 ? lines.join("\n") : "없음";
}

function normalizeKeyword(keyword: string) {
  return keyword.replace(/\s+/g, "").toLowerCase();
}

/** 지금 문구보다 새로 받은 트렌드의 상위 검색어 10개 중 절반 넘게가 keywords에 없으면 다시 쓴다 */
// ponytail: 관련 없는 인기 검색어가 상위에 계속 끼면 매달 다시 쓰게 된다. 비용이 문제면 관련 검색어만 세도록 좁힐 것
async function isStale(slug: string, seo: GameSeo) {
  const report = await loadKeywordReport(slug);
  if (!report || report.fetchedAt <= seo.updatedAt) return false;
  const current = new Set(seo.keywords.map(normalizeKeyword));
  const top = report.keywords.slice(0, 10).map((stat) => normalizeKeyword(stat.keyword));
  return top.filter((keyword) => current.has(keyword)).length < top.length / 2;
}

function isStringList(value: string[] | undefined): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseSeo(text: string, slug: string): GeneratedSeo {
  const raw: Partial<GeneratedSeo> = JSON.parse(text);
  const { metaTitle, metaDescription, guideDescription, keywords, intro, howToPlay, tips, faq, guide } = raw;
  if (
    typeof metaTitle !== "string" ||
    typeof metaDescription !== "string" ||
    typeof guideDescription !== "string" ||
    typeof intro !== "string" ||
    !isStringList(keywords) ||
    !isStringList(howToPlay) ||
    !isStringList(tips) ||
    !Array.isArray(faq) ||
    !Array.isArray(guide)
  ) {
    fail(`${slug}: 응답 JSON이 GameSeo 모양과 다릅니다\n${text}`);
  }
  return { metaTitle, metaDescription, guideDescription, keywords, intro, howToPlay, tips, faq, guide };
}

const client = new Anthropic();

async function generate(game: RegistryGame, games: RegistryGame[]): Promise<GameSeo> {
  const report = await loadKeywordReport(game.slug);
  const prompt = [
    `## 게임\nslug: ${game.slug}\n이름: ${game.title}\n한 줄 설명: ${game.description}`,
    `## 네이버 검색어 트렌드 (monthlySearches: 월간 검색수, trend: 최근 4주 ÷ 이전 12주 평균)\n${
      report ? JSON.stringify(report.keywords, null, 2) : "없음. 게임 내용에서 사람들이 검색할 법한 말을 고른다"
    }`,
    `## 이미 있는 다른 게임 문구 (겹치지 않게)\n${await otherGamesSummary(games, game.slug)}`,
    `## 게임 소스 코드\n${await readSources(game.slug)}`,
  ].join("\n\n");

  // 정책 거절 시 서버가 다른 모델로 이어서 답하도록 fallbacks를 켠다
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: { type: "json_schema", schema: SEO_SCHEMA } },
  });
  if (response.stop_reason === "refusal") fail(`${game.slug}: 모델이 요청을 거절했습니다`);
  if (response.stop_reason === "max_tokens") fail(`${game.slug}: 응답이 max_tokens에서 잘렸습니다`);

  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  return { ...parseSeo(text, game.slug), updatedAt: today() };
}

async function writeSeo(slug: string, seo: GameSeo) {
  const body = JSON.stringify(seo, null, 2).replace(/^(\s*)"(\w+)":/gm, "$1$2:");
  const source = `import type { GameSeo } from "@/lib/games/types";

// pnpm seo:generate로 생성. 코드와 다른 사실이 없는지 검토한 뒤 커밋한다
export const seo: GameSeo = ${body};
`;
  await writeFile(join(gameDir(slug), "seo.ts"), source);
}

const args = process.argv.slice(2);
const registry = await readRegistry();
const targets: RegistryGame[] = [];
for (const game of await resolveGames(args)) {
  const seo = await loadSeo(game.slug);
  if (args.includes("--missing") && seo) continue;
  if (args.includes("--stale") && (!seo || !(await isStale(game.slug, seo)))) continue;
  targets.push(game);
}

if (targets.length === 0) {
  console.log("다시 쓸 게임이 없습니다");
} else {
  for (const game of targets) {
    console.log(`${game.slug}: 생성 중…`);
    await writeSeo(game.slug, await generate(game, registry));
    console.log(`${game.slug}: seo.ts 저장`);
  }
  console.log("\n검토: git diff app/games/_games\n검증: pnpm test lib/games/seo");
}
