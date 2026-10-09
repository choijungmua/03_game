import Link from "next/link";

import { LegalPage } from "@/app/_legal/legal-page";
import { JsonLd, organizationJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/site";

import { COMPANY, COMPANY_ROWS } from "./company";

export const metadata = pageMetadata({
  title: "회사 소개",
  description: "무료 웹게임 서비스 ggpli를 만드는 회사 GGPLI 소개. 운영 주체, 설립 정보, 팀, 하는 일과 연락처를 안내합니다.",
  path: "/about",
});

const LINK = "inline-flex min-h-11 items-center rounded-md text-foreground underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-capybara-dark";

export default function AboutPage() {
  return (
    <LegalPage title="회사 소개">
      <JsonLd data={organizationJsonLd()} />
      <p className="text-center">ggpli는 {COMPANY.name}이 만들고 운영하는 무료 웹게임 서비스입니다.</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">하는 일</h2>
        <p>
          설치·회원가입 없이 브라우저에서 바로 즐기는 미니게임을 만듭니다. 반응속도·클릭 속도 테스트 같은 짧은 게임부터
          친구를 초대해 겨루는 온라인 바둑·오목·알까기, 카피바라 마을 로비에서 함께 노는 실시간 기능까지 직접 개발합니다.
          서비스는 <time dateTime={COMPANY.launchedAt}>2026년 9월</time>에 공개했고, 게임을 계속 추가하고 있습니다.
        </p>
        <Link href="/games" className={LINK}>
          게임 목록 보기
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">팀</h2>
        <p>
          두 명이 함께 만듭니다. 운영자가 기획·프론트엔드·운영을 맡고, 백엔드 담당자가 게임 서버와 실시간 기능을 개발합니다.
          게임 그래픽과 공략 문서 제작에는 생성형 AI를 적극적으로 활용합니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">운영 주체</h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          {COMPANY_ROWS.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="font-semibold text-foreground">{label}</dt>
              <dd translate="no" className="break-all">
                {label === "이메일" ? (
                  <a href={`mailto:${value}`} className="underline underline-offset-2">
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-2" lang="en">
        <h2 className="text-base font-semibold text-foreground">About ggpli (English)</h2>
        <p>
          ggpli.com is a free browser-game service built and operated by {COMPANY.name}, a two-person team based in
          South Korea, founded by {COMPANY.representative} in September 2026. We build install-free mini games such as
          reaction and click-speed tests, shooters, and real-time multiplayer board games (Go, Gomoku, Alkkagi), all
          sharing one capybara-village lobby. The service is funded by advertising. Business inquiries:{" "}
          <a href={`mailto:${COMPANY.email}`} className="underline underline-offset-2">
            {COMPANY.email}
          </a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">함께 보기</h2>
        <ul className="space-y-1">
          <li>
            <Link href="/contact" className="inline-flex min-h-8 items-center text-foreground underline underline-offset-2">
              문의
            </Link>
          </li>
          <li>
            <Link href="/terms" className="inline-flex min-h-8 items-center text-foreground underline underline-offset-2">
              이용약관
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="inline-flex min-h-8 items-center text-foreground underline underline-offset-2">
              개인정보처리방침
            </Link>
          </li>
        </ul>
      </section>
    </LegalPage>
  );
}
