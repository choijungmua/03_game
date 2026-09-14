import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GAMES, getAllGameSeo } from "./registry";

describe("게임별 SEO 문구", () => {
  it("등록된 게임마다 폴더에 seo.ts가 있다", () => {
    GAMES.forEach((game) => {
      expect(existsSync(join(process.cwd(), "app/games/_games", game.slug, "seo.ts")), game.slug).toBe(true);
    });
  });

  it.each(GAMES.map((game) => [game.slug, game] as const))(
    "%s: 검색 결과에 맞는 길이와 개수를 지킨다",
    async (_, game) => {
      const { seo } = await game.seo();

      for (const description of [seo.metaDescription, seo.guideDescription]) {
        expect(description.length).toBeGreaterThanOrEqual(60);
        expect(description.length).toBeLessThanOrEqual(160);
      }
      expect(seo.metaDescription).not.toBe(seo.guideDescription);
      expect(seo.keywords.some((keyword) => keyword.includes(game.title)), "게임 이름이 든 검색어").toBe(true);
      expect(seo.keywords.length).toBeGreaterThanOrEqual(5);
      expect(new Set(seo.keywords).size).toBe(seo.keywords.length);
      expect(seo.intro.length).toBeGreaterThanOrEqual(80);
      expect(seo.howToPlay.length).toBeGreaterThanOrEqual(3);
      expect(seo.tips.length).toBeGreaterThanOrEqual(3);
      expect(seo.faq.length).toBeGreaterThanOrEqual(3);
      expect(seo.guide.length).toBeGreaterThanOrEqual(3);
      expect(seo.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(seo.updatedAt))).toBe(false);
    },
  );

  it("게임끼리 설명·소개가 겹치지 않는다 (중복 콘텐츠 방지)", async () => {
    const entries = await getAllGameSeo();
    for (const field of ["metaDescription", "guideDescription", "intro"] as const) {
      const values = entries.map(({ seo }) => seo[field]);
      expect(new Set(values).size, field).toBe(values.length);
    }
  });
});
