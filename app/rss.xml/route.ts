import { getAllGameSeo } from "@/lib/games/registry";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo/site";

export const dynamic = "force-static";

function escapeXml(text: string) {
  return text.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** 네이버 서치어드바이저에 제출하는 RSS. 게임이 추가되면 새 항목으로 수집된다 */
export async function GET() {
  const items = (await getAllGameSeo()).map(({ game, seo }) => {
    const url = absoluteUrl(`/games/${game.slug}`);
    return [
      "<item>",
      `<title>${escapeXml(game.title)}</title>`,
      `<link>${url}</link>`,
      `<guid>${url}</guid>`,
      `<description>${escapeXml(seo.metaDescription)}</description>`,
      `<pubDate>${new Date(seo.updatedAt).toUTCString()}</pubDate>`,
      "</item>",
    ].join("");
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"><channel>',
    `<title>${SITE_NAME}</title>`,
    `<link>${absoluteUrl("/")}</link>`,
    `<description>${escapeXml(SITE_DESCRIPTION)}</description>`,
    "<language>ko</language>",
    ...items,
    "</channel></rss>",
  ].join("");

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
