import { GAMES, getGame } from "@/lib/games/registry";
import { gameIconPath, OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { SITE_NAME } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = `${SITE_NAME} 무료 게임`;

/** 빌드할 때 게임마다 미리 그려 둔다 (요청마다 폰트를 받아 그리지 않게) */
export function generateStaticParams() {
  return GAMES.map((game) => ({ slug: game.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderOgImage({
    title: getGame(slug)?.title ?? SITE_NAME,
    subtitle: "설치·로그인 없이 바로 하는 무료 게임",
    icon: gameIconPath(slug),
  });
}
