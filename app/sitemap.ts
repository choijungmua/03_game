import type { MetadataRoute } from "next";

import { getAllGameSeo } from "@/lib/games/registry";
import { absoluteUrl } from "@/lib/seo/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // /list는 관리자용 noindex 페이지라 넣지 않는다
  const staticPages = ["/", "/games", "/privacy", "/terms", "/contact"].map((path) => ({
    url: absoluteUrl(path),
  }));

  const gamePages = (await getAllGameSeo()).flatMap(({ game, seo }) => [
    { url: absoluteUrl(`/games/${game.slug}`), lastModified: seo.updatedAt },
    { url: absoluteUrl(`/games/${game.slug}/guide`), lastModified: seo.updatedAt },
  ]);

  return [...staticPages, ...gamePages];
}
