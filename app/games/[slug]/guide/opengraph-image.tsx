import { GAMES, getGame } from "@/lib/games/registry";
import { gameIconPath, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { SITE_NAME } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = `${SITE_NAME} 게임 공략 가이드`;

export function generateStaticParams() {
  return GAMES.map((game) => ({ slug: game.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderOgImage({
    title: `${getGame(slug)?.title ?? SITE_NAME} 공략 가이드`,
    subtitle: "하는 법·등급 기준·공략 팁 정리",
    icon: gameIconPath(slug),
  });
}
