import NextImage from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { emoteImage } from "@/lib/games/emotes";

import { CAPYBARA_IDLE, MEADOW_TEXTURE, PARTY_EMOTE, READING_LEFT, READING_RIGHT, SLEEP_EMOTE } from "./constants";

/** 나무 테두리 알약 버튼 (로비 앉기·때리기 테두리 색) */
const WOOD_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-1 rounded-full border-4 border-capybara bg-capybara-light px-5 text-sm font-bold text-capybara-dark shadow-md transition-[filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-capybara-dark";

/**
 * 이용약관·개인정보처리방침·문의 공용 틀. 화면 전체를 로비 풀밭으로 덮고, 카피바라가 고개를 내민 크림색 종이에 본문을 올린다.
 * 맨 아래 "약속해요" 체크는 장식이라 아무것도 막지 않는다 (체크하면 자던 카피바라가 신나는 그림으로 바뀔 뿐, CSS만 쓴다)
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main
      // 본문 컴포넌트의 글자색 토큰을 카피바라 짙은 털색으로 바꿔 그대로 쓴다. 밝은 종이라 체크박스도 밝은 모양(color-scheme: light)으로
      className="min-h-dvh w-full scheme-light px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] [--foreground:var(--capybara-dark)] [--muted-foreground:color-mix(in_oklab,var(--capybara-dark)_80%,var(--capybara-light))]"
      style={{ backgroundImage: `url(${MEADOW_TEXTURE})` }}
    >
      <Link href="/" className={WOOD_BUTTON}>
        ← 로비로
      </Link>

      <div className="relative mx-auto mt-28 max-w-lg">
        <article className="rounded-[2rem] border-8 border-capybara bg-[color-mix(in_oklab,var(--capybara-light)_28%,white)] px-5 pb-8 pt-14 text-foreground shadow-xl sm:px-8">
          {/* 좁은 화면: 읽는 카피바라 둘이 제목 양옆에서 종이를 본다 (넓은 화면은 종이 바깥 양옆에 크게) */}
          <div className="flex items-center justify-center gap-2">
            <NextImage src={READING_RIGHT} alt="" width={96} height={96} unoptimized className="size-16 lg:hidden" />
            <h1 className="min-w-0 text-balance text-center text-2xl font-bold">{title}</h1>
            <NextImage src={READING_LEFT} alt="" width={96} height={96} unoptimized className="size-16 lg:hidden" />
          </div>

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">{children}</div>

          <footer className="mt-10 flex flex-col items-center gap-4 border-t-4 border-dotted border-capybara/40 pt-8 text-center">
            <label className="group flex cursor-pointer flex-col items-center gap-2">
              <span aria-hidden className="relative size-28">
                <NextImage src={emoteImage(SLEEP_EMOTE)} alt="" fill unoptimized sizes="112px" className="group-has-checked:hidden" />
                <NextImage src={emoteImage(PARTY_EMOTE)} alt="" fill unoptimized sizes="112px" className="hidden group-has-checked:block" />
              </span>
              <span className="flex min-h-11 items-center gap-2 text-base font-bold">
                <input type="checkbox" className="size-5 cursor-pointer accent-capybara-dark" />
                카피바라랑 사이좋게 놀기로 약속해요
              </span>
              <span className="text-xs text-muted-foreground group-has-checked:hidden">카피바라가 다 읽을 때까지 기다리다 잠들었어요…</span>
              <span className="hidden text-xs font-semibold group-has-checked:inline">약속 완료! 이제 같이 놀아요</span>
            </label>
            <Link href="/" className={WOOD_BUTTON}>
              로비로 놀러 가기
            </Link>
          </footer>
        </article>

        {/* 종이 위 가장자리에 발을 걸친 카피바라 */}
        <NextImage
          src={CAPYBARA_IDLE}
          alt=""
          width={160}
          height={160}
          unoptimized
          priority
          className="pointer-events-none absolute left-1/2 top-0 size-32 -translate-x-1/2 -translate-y-3/4 drop-shadow-lg"
        />
      </div>

      {/* 넓은 화면: 종이(폭 32rem) 바깥 양옆 아래에 붙어 있어 스크롤해도 같이 읽는다. 카피바라 폭 14rem + 틈 1rem */}
      <NextImage
        src={READING_RIGHT}
        alt=""
        width={384}
        height={384}
        unoptimized
        className="pointer-events-none fixed bottom-4 left-[calc(50%-31rem)] hidden size-56 drop-shadow-lg lg:block"
      />
      <NextImage
        src={READING_LEFT}
        alt=""
        width={384}
        height={384}
        unoptimized
        className="pointer-events-none fixed bottom-4 right-[calc(50%-31rem)] hidden size-56 drop-shadow-lg lg:block"
      />
    </main>
  );
}
