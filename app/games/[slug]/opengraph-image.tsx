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
  const game = getGame(slug);
  return renderOgImage({
    title: game?.pageName ?? SITE_NAME,
    subtitle: game ? `${game.title} · 무료 게임` : "무료 게임",
    icon: gameIconPath(slug),
  });
}
