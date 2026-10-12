import type { Metadata } from "next";
import Link from "next/link";

import { LIST_ONLY_GAMES } from "@/lib/games/constants";
import { GAMES } from "@/lib/games/registry";
import { pageMetadata, siteTitle } from "@/lib/seo/site";

import { Lobby } from "./_lobby/lobby";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "카피바라 마을 · 무료 카피바라 게임",
    description:
      "카피바라가 되어 온천 습지 마을을 산책하고 낚시와 옷 꾸미기를 즐겨 보세요. 오두막에서 카피바라 런·배구·슈팅 등 무료 게임을 시작하거나 친구와 온라인 대전을 할 수 있습니다. 설치·로그인 없이 바로 플레이하세요.",
    path: "/",
    keywords: ["카피바라", "카피바라 게임", "카피바라 마을", "무료 게임", "웹게임", ...GAMES.map((game) => game.title)],
  }),
  // 레이아웃 title.template은 같은 폴더의 page에는 적용되지 않아 전체 제목을 직접 둔다
  title: { absolute: siteTitle("카피바라 마을 · 무료 카피바라 게임") },
};

export default function Home() {
  return (
    <main className="h-dvh overflow-hidden bg-background text-foreground">
      <h1 className="sr-only">카피바라 마을</h1>
      <section id="lobby" aria-label="카피바라 게임 로비" className="relative h-dvh w-full scroll-mt-4 overflow-hidden">
        <Lobby
          games={GAMES.filter((game) => !LIST_ONLY_GAMES.includes(game.slug)).map(({ slug, title }) => ({ slug, title }))}
        />
      {/* 걷지 않고도(키보드·스크린리더·검색엔진) 모든 게임에 바로 갈 수 있는 링크. 포커스가 들어오면 보인다 */}
        <nav
        aria-label="게임 바로가기"
        className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:left-4 focus-within:top-4 focus-within:rounded-xl focus-within:bg-card focus-within:p-2 focus-within:shadow-md"
      >
        <ul>
          {GAMES.map((game) => (
            <li key={game.slug}>
              <Link
                href={`/games/${game.slug}`}
                className="block min-h-11 rounded-lg px-3 py-2.5 text-body-2 text-text-strong focus-visible:outline-2 focus-visible:outline-primary"
              >
                {game.title}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/games"
              className="block min-h-11 rounded-lg px-3 py-2.5 text-body-2 text-text-strong focus-visible:outline-2 focus-visible:outline-primary"
            >
              전체 게임 목록
            </Link>
          </li>
        </ul>
        </nav>
      </section>
    </main>
  );
}
