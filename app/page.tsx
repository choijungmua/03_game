import type { Metadata } from "next";
import Link from "next/link";

import { GAMES } from "@/lib/games/registry";
import { pageMetadata, siteTitle } from "@/lib/seo/site";

import { Lobby } from "./_lobby/lobby";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "lobby",
    description:
      "카피바라를 걸어 다니며 온천 습지 마을의 오두막에 들어가 반응속도 테스트, 클릭 속도 테스트, 바둑, 오목, 알까기 등 무료 게임을 하는 오픈월드 로비. 설치·로그인 없이 브라우저에서 바로 플레이",
    path: "/",
    keywords: ["무료 게임", "미니게임", "웹게임", "카피바라 게임", ...GAMES.map((game) => game.title)],
  }),
  // 레이아웃 title.template은 같은 폴더의 page에는 적용되지 않아 전체 제목을 직접 둔다
  title: { absolute: siteTitle("lobby") },
};

export default function Home() {
  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-background">
      <h1 className="sr-only">ggpli 로비</h1>
      <Lobby games={GAMES.map(({ slug, title }) => ({ slug, title }))} />
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
    </main>
  );
}
