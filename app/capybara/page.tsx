import Link from "next/link";

import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata({
  title: "카피바라는 어떤 동물일까? 특징·먹이·서식지",
  description: "카피바라의 특징, 먹이, 서식지와 물속 생활을 동물원 자료로 알아보세요. 실제 카피바라와 ggpli 게임 속 카피바라의 차이도 소개합니다.",
  path: "/capybara",
});

const LINK = "inline-flex min-h-11 items-center text-primary underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function CapybaraPage() {
  return (
    <main className="min-h-dvh bg-background px-5 pt-10 pb-[max(4rem,env(safe-area-inset-bottom))] text-foreground">
      <JsonLd data={breadcrumbJsonLd([{ name: "홈", path: "/" }, { name: "카피바라 소개", path: "/capybara" }])} />
      <article className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link href="/games" className={`${LINK} self-start`}>카피바라 게임 목록</Link>
          <h1 className="text-title-1 text-balance text-text-strong">카피바라는 어떤 동물일까요?</h1>
          <p className="text-base text-text-normal">
            카피바라는 남아메리카의 물가에 사는 커다란 설치류입니다. 둥근 몸과 짧은 다리 때문에 돼지를 떠올리기 쉽지만,
            기니피그와 가까운 동물이에요. ggpli 마을의 주인공이 된 카피바라를 실제 생태와 함께 알아보세요.
          </p>
          <p className="text-caption-1 text-text-normal">정리: ggpli · 자료 확인 <time dateTime="2026-10-13">2026년 10월 13일</time></p>
        </header>

        <section aria-labelledby="capybara-features" className="flex flex-col gap-3">
          <h2 id="capybara-features" className="scroll-mt-8 text-title-2 text-balance text-text-strong">가장 큰 설치류, 물가에 맞춰진 몸</h2>
          <p className="text-base text-text-normal">
            체스터 동물원은 카피바라를 세계에서 가장 큰 설치류로 소개합니다. 학명은 <i lang="la" translate="no">Hydrochoerus hydrochaeris</i>입니다.
            발가락 사이의 물갈퀴는 헤엄칠 때 도움이 되고, 눈·귀·콧구멍은 머리 위쪽에 있어 물에 몸을 담근 채 주변을 살필 수 있습니다.
          </p>
          <a href="https://www.chesterzoo.org/animals/capybara" className={`${LINK} self-start`}>체스터 동물원의 특징 설명 읽기</a>
        </section>

        <section aria-labelledby="capybara-habitat" className="flex flex-col gap-3">
          <h2 id="capybara-habitat" className="scroll-mt-8 text-title-2 text-balance text-text-strong">어디에 살고, 무엇을 먹나요?</h2>
          <p className="text-base text-text-normal">
            강과 연못 주변의 습지·초원처럼 물에 가까운 곳에서 생활합니다. 먹이는 주로 풀과 수생식물입니다.
            물은 먹이를 찾는 장소이면서 더위를 식히고 위험을 피하는 공간이기도 합니다. 샌디에이고 동물원에 따르면
            포식자를 피해 한 번에 최대 5분 정도 물속에 머물 수 있습니다.
          </p>
          <a href="https://animals.sandiegozoo.org/animals/capybara" className={`${LINK} self-start`}>샌디에이고 동물원의 서식지·먹이 설명 읽기</a>
        </section>

        <section aria-labelledby="capybara-groups" className="flex flex-col gap-3">
          <h2 id="capybara-groups" className="scroll-mt-8 text-title-2 text-balance text-text-strong">무리 생활과 조용한 모습</h2>
          <p className="text-base text-text-normal">
            카피바라는 무리를 이루며 생활합니다. 체스터 동물원은 사회성이 있으면서도 경계심이 있는 동물이라고 설명합니다.
            얌전히 쉬는 사진만으로 모든 동물과 친하다거나 항상 순하다고 단정할 수는 없습니다.
            재규어·카이만 같은 포식자를 만나면 물속으로 몸을 숨기기도 합니다.
          </p>
        </section>

        <section aria-labelledby="capybara-in-games" className="flex flex-col gap-3">
          <h2 id="capybara-in-games" className="scroll-mt-8 text-title-2 text-balance text-text-strong">ggpli 게임 속 카피바라는 어떻게 다를까요?</h2>
          <p className="text-base text-text-normal">
            마을 로비의 물가와 함께 모여 쉬는 모습은 카피바라의 생활을 떠올릴 수 있는 배경입니다.
            모자를 쓰거나 배구를 하고 비행기를 조종하는 모습은 게임을 위한 상상이에요.
            게임 속 간식·행동·능력은 실제 동물의 먹이나 사육 방법을 안내하는 정보가 아닙니다.
          </p>
          <p className="text-base text-text-normal">
            카피바라 캐릭터로 직접 놀고 싶다면 장애물을 넘는 런, 친구와 겨루는 배구, 동물 블록을 맞추는 바라매치를 골라 보세요.
            게임 목록에서 조작법과 공략도 함께 볼 수 있습니다.
          </p>
          <Link href="/games" className={`${LINK} self-start`}>무료 카피바라 게임 고르기</Link>
          <Link href="/" className={`${LINK} self-start`}>카피바라 마을 둘러보기</Link>
        </section>

        <footer className="border-t border-border-default pt-5 text-caption-1 text-text-normal">
          생태 소개는 위에 연결한 동물원 공개 자료를, 게임 소개는 ggpli의 현재 기능을 기준으로 정리했습니다.
          <Link href="/contact" className={`${LINK} mt-2`}>내용 오류 제보하기</Link>
        </footer>
      </article>
    </main>
  );
}
