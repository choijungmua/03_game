import Link from "next/link";

import { GAMES } from "@/lib/games/registry";
import { absoluteUrl, pageMetadata, SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/seo/site";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/json-ld";

export const metadata = pageMetadata({
  title: "게임 목록",
  description: SITE_DESCRIPTION,
  path: "/games",
  keywords: ["무료 게임", "미니게임", "웹게임", "브라우저 게임", "설치 없는 게임", ...GAMES.map((game) => game.title)],
});

export default function GamesPage() {
  return (
    <main className="min-h-dvh bg-background px-5 pt-10 pb-[max(4rem,env(safe-area-inset-bottom))] text-foreground">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: SITE_TAGLINE,
          itemListElement: GAMES.map((game, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: game.title,
            url: absoluteUrl(`/games/${game.slug}`),
          })),
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "홈", path: "/" },
          { name: "게임", path: "/games" },
        ])}
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-title-1 text-text-strong">{SITE_TAGLINE}</h1>
          <p className="text-base text-text-normal">{SITE_DESCRIPTION}</p>
        </header>

        <ul className="flex flex-col divide-y divide-border-default">
          {GAMES.map((game) => (
            <li key={game.slug} className="flex flex-col gap-1 py-5">
              <h2 className="text-title-3">
                <Link
                  href={`/games/${game.slug}`}
                  className="text-text-strong transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {game.title}
                </Link>
              </h2>
              <p className="text-base text-text-normal">{game.description}</p>
              <Link
                href={`/games/${game.slug}/guide`}
                className="flex min-h-11 items-center self-start text-caption-1 text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {game.title} 하는 법·공략
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
