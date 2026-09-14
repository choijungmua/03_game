import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GameAbout } from "@/app/games/_components/game-info";
import { GAMES, getGame } from "@/lib/games/registry";
import { breadcrumbJsonLd, gameJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/site";

interface GamePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return GAMES.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({
  params,
}: GamePageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) return {};

  const { seo } = await game.seo();
  return pageMetadata({
    title: game.title,
    description: seo.metaDescription,
    path: `/games/${slug}`,
    keywords: seo.keywords,
  });
}

export default async function GamePage({ params }: GamePageProps) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();

  const { seo } = await game.seo();
  const Game = game.component;
  return (
    <main>
      <JsonLd data={gameJsonLd(game, seo)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/" },
          { name: "게임", path: "/games" },
          { name: game.title, path: `/games/${slug}` },
        ])}
      />
      <Game />
      <GameAbout game={game} seo={seo} />
    </main>
  );
}
