import { getAllGameSeo } from "@/lib/games/registry";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo/site";

export const dynamic = "force-static";

/** AI 검색·챗봇이 사이트를 요약할 때 읽는 안내문 (구글 순위와는 무관, 다른 AI 서비스용) */
export async function GET() {
  const games = (await getAllGameSeo()).map(
    ({ game, seo }) =>
      `- [${game.title}](${absoluteUrl(`/games/${game.slug}`)}): ${seo.metaDescription} ([공략 가이드](${absoluteUrl(`/games/${game.slug}/guide`)}))`,
  );

  const text = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "## 게임",
    "",
    ...games,
    "",
    "## 목록",
    "",
    `- [전체 게임 목록](${absoluteUrl("/games")})`,
    "",
  ].join("\n");

  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
