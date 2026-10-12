import Link from "next/link";

import { GAMES } from "@/lib/games/registry";
import { absoluteUrl, pageMetadata, SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/seo/site";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/json-ld";

export const metadata = pageMetadata({
  title: "카피바라 게임 모음 · 무료로 바로 하기",
  description: SITE_DESCRIPTION,
  path: "/games",
  keywords: ["카피바라 게임", "무료 카피바라 게임", "무료 게임", "웹게임", "설치 없는 게임", ...GAMES.map((game) => game.title)],
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

        <section aria-labelledby="choose-game" className="flex flex-col gap-4">
          <h2 id="choose-game" className="text-title-2 text-text-strong">어떤 게임부터 할까요?</h2>
          <div className="flex flex-col gap-1">
            <h3 className="text-title-3 text-text-strong">혼자 기록에 도전하고 싶다면</h3>
            <p className="text-base text-text-normal">
              점프와 숙이기로 장애물을 넘는 카피바라 런, 굴러오는 통나무를 피하며 버티는 통나무 피하기를 골라 보세요.
              빠른 조작보다 퍼즐이 좋다면 같은 동물 세 개를 맞추는 바라매치가 있습니다.
            </p>
            <Link
              href="/games/capybara-run/guide"
              className="flex min-h-11 items-center self-start text-caption-1 text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              카피바라 런 조작과 장애물 공략
            </Link>
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-title-3 text-text-strong">친구와 둘이 하고 싶다면</h3>
            <p className="text-base text-text-normal">
              카피바라 배구는 한 PC의 키보드를 나눠 쓰거나, 각자 접속해 초대 코드로 온라인 대전을 할 수 있습니다.
              차례대로 생각하며 두고 싶다면 바둑·오목·알까기에서 친구를 초대하세요. 이 게임들은 컴퓨터와 혼자서도 할 수 있습니다.
            </p>
            <Link
              href="/games/capybara-volleyball/guide"
              className="flex min-h-11 items-center self-start text-caption-1 text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              카피바라 배구 친구 초대와 조작 방법
            </Link>
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-title-3 text-text-strong">휴대폰으로 가볍게 시작하려면</h3>
            <p className="text-base text-text-normal">
              블록을 탭하거나 밀어서 맞추는 바라매치부터 시작해 보세요. 앱 설치 없이 브라우저에서 실행됩니다.
              게임마다 조작이 다르니 게임별 ‘하는 법·공략’에서 터치 버튼과 키보드 조작을 확인할 수 있습니다.
              배구의 ‘한 키보드로 둘이 하기’는 PC 키보드용입니다.
            </p>
            <Link
              href="/games/capybara-pang"
              className="flex min-h-11 items-center self-start text-caption-1 text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              바라매치 시작하기
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
