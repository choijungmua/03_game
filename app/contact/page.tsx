import Link from "next/link";

import { pageMetadata } from "@/lib/seo/site";

import { CONTACT_EMAIL } from "./constants";

export const metadata = pageMetadata({
  title: "contact",
  description: "ggpli 게임 오류 제보, 광고·제휴, 개인정보 관련 문의",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-foreground">
      <article className="mx-auto max-w-md space-y-8 text-sm leading-relaxed text-muted-foreground">
        <header className="space-y-2">
          <Link href="/" className="inline-flex min-h-8 items-center text-xs hover:text-foreground">
            ← 홈으로
          </Link>
          <h1 className="text-2xl font-bold text-foreground">문의</h1>
          <p>ggpli 이용 중 궁금한 점이나 불편한 점이 있으면 메일로 알려 주세요.</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">메일 주소</h2>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            translate="no"
            className="flex min-h-11 items-center justify-center rounded-lg border border-border-default text-base font-semibold text-foreground transition-colors hover:bg-card"
          >
            {CONTACT_EMAIL}
          </a>
          <p className="text-xs">보통 영업일 기준 3일 안에 답장드려요.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">이런 내용을 받아요</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>게임 오류·버그 제보 (게임 이름, 기기·브라우저, 어떤 상황이었는지 적어 주시면 빨리 고칠 수 있어요)</li>
            <li>로비 채팅의 욕설·불쾌한 행동 신고</li>
            <li>게임 아이디어 제안</li>
            <li>광고·제휴 문의</li>
            <li>개인정보·저작권 관련 요청</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">함께 보기</h2>
          <ul className="space-y-1">
            <li>
              <Link href="/privacy" className="inline-flex min-h-8 items-center text-foreground underline underline-offset-2">
                개인정보처리방침
              </Link>
            </li>
            <li>
              <Link href="/terms" className="inline-flex min-h-8 items-center text-foreground underline underline-offset-2">
                이용약관
              </Link>
            </li>
          </ul>
        </section>
      </article>
    </main>
  );
}
