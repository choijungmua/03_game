/**
 * 네이버 검색어 트렌드 수집
 *   pnpm seo:keywords <slug...> | --all
 *
 * 게임 이름과 지금 쓰는 검색어로 네이버 검색광고 키워드도구에서 연관 검색어·월간 검색수를 받고,
 * 상위 검색어는 데이터랩으로 최근 추세를 붙여 게임 폴더의 seo-keywords.json에 남긴다.
 * pnpm seo:generate가 이 파일을 읽어 문구에 반영한다.
 */
import { createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { fail, gameDir, type KeywordReport, type KeywordStat, loadSeo, resolveGames, today } from "./common.ts";

const TOP_KEYWORDS = 30;
const TREND_KEYWORDS = 10;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface NaverKeyword {
  relKeyword: string;
  monthlyPcQcCnt: number | string;
  monthlyMobileQcCnt: number | string;
  compIdx: string;
}

interface DatalabResult {
  title: string;
  data: { period: string; ratio: number }[];
}

function env(name: string) {
  return process.env[name] ?? "";
}

/** 검색수가 10 미만이면 숫자 대신 "< 10" 문자열이 온다 */
function searchCount(value: number | string | undefined) {
  return typeof value === "number" ? value : 5;
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function fetchRelatedKeywords(seeds: string[]): Promise<KeywordStat[]> {
  const apiKey = env("NAVER_SEARCHAD_API_KEY");
  const secret = env("NAVER_SEARCHAD_SECRET");
  const customerId = env("NAVER_SEARCHAD_CUSTOMER_ID");
  if (!apiKey || !secret || !customerId) {
    fail("NAVER_SEARCHAD_API_KEY·NAVER_SEARCHAD_SECRET·NAVER_SEARCHAD_CUSTOMER_ID가 필요합니다 (네이버 검색광고 → 도구 → API 사용 관리)");
  }

  const uri = "/keywordstool";
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", secret).update(`${timestamp}.GET.${uri}`).digest("base64");
  // 힌트 키워드는 최대 5개, 띄어쓰기 없이 보낸다
  const hintKeywords = seeds.slice(0, 5).map((seed) => seed.replace(/\s+/g, "")).join(",");
  const response = await fetch(`https://api.searchad.naver.com${uri}?${new URLSearchParams({ hintKeywords, showDetail: "1" })}`, {
    headers: { "X-Timestamp": timestamp, "X-API-KEY": apiKey, "X-Customer": customerId, "X-Signature": signature },
  });
  if (!response.ok) fail(`네이버 키워드도구 오류 ${response.status}: ${await response.text()}`);

  const body: Partial<{ keywordList: Partial<NaverKeyword>[] }> = await response.json();
  return (body.keywordList ?? []).flatMap((item) =>
    typeof item.relKeyword === "string"
      ? [
          {
            keyword: item.relKeyword,
            monthlySearches: searchCount(item.monthlyPcQcCnt) + searchCount(item.monthlyMobileQcCnt),
            competition: typeof item.compIdx === "string" ? item.compIdx : "",
            trend: null,
          },
        ]
      : [],
  );
}

/** 검색어별 최근 4주 ÷ 그 전 12주 평균. 데이터랩 키가 없으면 빈 Map */
async function fetchTrends(keywords: string[]) {
  const trends = new Map<string, number>();
  const clientId = env("NAVER_CLIENT_ID");
  const clientSecret = env("NAVER_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.warn("NAVER_CLIENT_ID·NAVER_CLIENT_SECRET이 없어 검색량 추세는 건너뜁니다");
    return trends;
  }

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 16 * WEEK_MS);
  // 데이터랩은 요청 한 번에 검색어 그룹 5개까지
  for (let start = 0; start < keywords.length; start += 5) {
    const group = keywords.slice(start, start + 5);
    const response = await fetch("https://openapi.naver.com/v1/datalab/search", {
      method: "POST",
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        timeUnit: "week",
        keywordGroups: group.map((keyword) => ({ groupName: keyword, keywords: [keyword] })),
      }),
    });
    if (!response.ok) fail(`네이버 데이터랩 오류 ${response.status}: ${await response.text()}`);

    const body: Partial<{ results: Partial<DatalabResult>[] }> = await response.json();
    for (const result of body.results ?? []) {
      if (typeof result.title !== "string" || !Array.isArray(result.data)) continue;
      const ratios = result.data.map((point) => point.ratio);
      const previous = average(ratios.slice(0, -4));
      if (previous > 0) trends.set(result.title, Math.round((average(ratios.slice(-4)) / previous) * 100) / 100);
    }
  }
  return trends;
}

const games = await resolveGames(process.argv.slice(2));

for (const game of games) {
  const seo = await loadSeo(game.slug);
  const seeds = [...new Set([game.title, ...(seo?.keywords ?? [])])].slice(0, 5);
  const related = await fetchRelatedKeywords(seeds);
  const top = related.sort((a, b) => b.monthlySearches - a.monthlySearches).slice(0, TOP_KEYWORDS);
  const trends = await fetchTrends(top.slice(0, TREND_KEYWORDS).map((stat) => stat.keyword));

  const report: KeywordReport = {
    fetchedAt: today(),
    seeds,
    keywords: top.map((stat) => ({ ...stat, trend: trends.get(stat.keyword) ?? null })),
  };
  await writeFile(join(gameDir(game.slug), "seo-keywords.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${game.slug}: 연관 검색어 ${top.length}개 → seo-keywords.json`);

  // 네이버 API 초당 호출 제한
  await new Promise((resolve) => setTimeout(resolve, 500));
}
