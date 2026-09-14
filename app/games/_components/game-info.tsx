import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/inputs/button";
import { GAMES } from "@/lib/games/registry";
import type { GameEntry, GameSeo } from "@/lib/games/types";

type GameSummary = Pick<GameEntry, "slug" | "title">;

const RELATED_COUNT = 6;
const headingClass = "scroll-mt-6 text-title-3 text-text-strong";
const bodyClass = "text-base text-text-normal";

export function HowToPlay({ seo }: { seo: GameSeo }) {
  return (
    <section aria-labelledby="how-to-play" className="flex flex-col gap-3">
      <h2 id="how-to-play" className={headingClass}>
        하는 법
      </h2>
      <ol className={`list-decimal space-y-2 pl-5 ${bodyClass}`}>
        {seo.howToPlay.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

export function Tips({ seo }: { seo: GameSeo }) {
  return (
    <section aria-labelledby="tips" className="flex flex-col gap-3">
      <h2 id="tips" className={headingClass}>
        공략 팁
      </h2>
      <ul className={`list-disc space-y-2 pl-5 ${bodyClass}`}>
        {seo.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </section>
  );
}

export function Faq({ seo }: { seo: GameSeo }) {
  return (
    <section aria-labelledby="faq" className="flex flex-col gap-1">
      <h2 id="faq" className={headingClass}>
        자주 묻는 질문
      </h2>
      <div className="divide-y divide-border-default">
        {seo.faq.map(({ question, answer }) => (
          <details key={question} className="group">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-md py-3 text-base font-medium text-text-strong focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              {question}
              <ChevronDown
                aria-hidden
                className="size-4 shrink-0 text-text-caption transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <p className={`pb-4 ${bodyClass}`}>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** 레지스트리에서 바로 뒤 게임들을 이어서 보여준다 — 게임마다 다른 게임으로 링크가 고르게 퍼진다 */
// ponytail: 등록 순서 이웃, 장르 분류가 생기면 같은 장르 우선으로
export function RelatedGames({ currentSlug }: { currentSlug: string }) {
  const index = GAMES.findIndex((game) => game.slug === currentSlug);
  const count = Math.min(RELATED_COUNT, GAMES.length - 1);
  const related = Array.from({ length: count }, (_, offset) => GAMES[(index + offset + 1) % GAMES.length]);
  if (related.length === 0) return null;

  return (
    <nav aria-labelledby="related-games" className="flex flex-col gap-2">
      <h2 id="related-games" className={headingClass}>
        다른 무료 게임
      </h2>
      <ul className="flex flex-col">
        {related.map((game) => (
          <li key={game.slug}>
            <Link
              href={`/games/${game.slug}`}
              className="flex min-h-12 min-w-0 flex-col justify-center rounded-md py-2 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="text-base font-medium text-text-strong">{game.title}</span>
              <span className="truncate text-caption-1 text-text-caption">{game.description}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/games"
            className="flex min-h-12 items-center rounded-md text-caption-1 text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            전체 게임 목록 보기
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/** 게임 화면 아래로 스크롤하면 나오는 소개. 첫 화면(게임)은 그대로 전체 화면이다 */
export function GameAbout({ game, seo }: { game: GameSummary; seo: GameSeo }) {
  return (
    <section
      aria-labelledby="game-about"
      className="border-t border-border-default bg-background px-5 pt-16 pb-[max(4rem,env(safe-area-inset-bottom))] text-foreground"
    >
      <div className="mx-auto flex max-w-md flex-col gap-12">
        <div className="flex flex-col gap-4">
          <h2 id="game-about" className="text-title-2 text-text-strong">
            {game.title} 소개
          </h2>
          <p className={bodyClass}>{seo.intro}</p>
          <Link
            href={`/games/${game.slug}/guide`}
            className={buttonVariants({ variant: "outline", size: "xl", className: "self-start" })}
          >
            공략 가이드 전체 보기
          </Link>
        </div>
        <HowToPlay seo={seo} />
        <Faq seo={seo} />
        <RelatedGames currentSlug={game.slug} />
      </div>
    </section>
  );
}
