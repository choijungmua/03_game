import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Faq, HowToPlay, RelatedGames, Tips } from "@/app/games/_components/game-info";
import { buttonVariants } from "@/components/inputs/button";
import { GAMES, getGame } from "@/lib/games/registry";
import { breadcrumbJsonLd, guideJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/site";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

const dateFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" });

function guideTitle(gameTitle: string) {
  return `${gameTitle} 하는 법·공략 가이드`;
}

export function generateStaticParams() {
  return GAMES.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) return {};

  const { seo } = await game.seo();
  return pageMetadata({
    title: guideTitle(game.title),
    description: seo.guideDescription,
    path: `/games/${slug}/guide`,
    keywords: seo.keywords,
  });
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();

  const { seo } = await game.seo();
  const title = guideTitle(game.title);
  const breadcrumb = [
    { name: "홈", path: "/" },
    { name: "게임", path: "/games" },
    { name: game.title, path: `/games/${slug}` },
    { name: "공략 가이드", path: `/games/${slug}/guide` },
  ];

  return (
    <main className="min-h-dvh bg-background px-5 pt-10 pb-[max(4rem,env(safe-area-inset-bottom))] text-foreground">
      <JsonLd data={guideJsonLd(game, seo, title)} />
      <JsonLd data={breadcrumbJsonLd(breadcrumb)} />

      <article className="mx-auto flex max-w-2xl flex-col gap-12">
        <nav aria-label="현재 위치">
          <ol className="flex flex-wrap items-center gap-x-2 text-caption-1 text-text-caption">
            {breadcrumb.slice(0, -1).map((item) => (
              <li key={item.path} className="flex items-center gap-2">
                <Link href={item.path} className="hover:text-text-strong">
                  {item.name}
                </Link>
                <span aria-hidden>›</span>
              </li>
            ))}
            <li aria-current="page">공략 가이드</li>
          </ol>
        </nav>

        <header className="flex flex-col gap-4">
          <h1 className="text-title-1 text-balance text-text-strong">{title}</h1>
          <p className="text-base text-text-normal">{seo.intro}</p>
          <p className="text-caption-1 text-text-caption">
            마지막 업데이트 <time dateTime={seo.updatedAt}>{dateFormat.format(new Date(seo.updatedAt))}</time>
          </p>
          <Link href={`/games/${slug}`} className={buttonVariants({ size: "xl", className: "self-start" })}>
            {game.title} 바로 하기
          </Link>
        </header>

        {seo.guide.map((section, index) => (
          <section key={section.heading} aria-labelledby={`guide-${index}`} className="flex flex-col gap-3">
            <h2 id={`guide-${index}`} className="scroll-mt-6 text-title-2 text-text-strong">
              {section.heading}
            </h2>
            <p className="whitespace-pre-line text-base text-text-normal">{section.body}</p>
          </section>
        ))}

        <HowToPlay seo={seo} />
        <Tips seo={seo} />
        <Faq seo={seo} />
        <RelatedGames currentSlug={slug} />
      </article>
    </main>
  );
}
