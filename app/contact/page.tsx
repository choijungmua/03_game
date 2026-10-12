import Link from "next/link";

import { LegalPage } from "@/app/_legal/legal-page";
import { pageMetadata } from "@/lib/seo/site";

import { CONTACT_EMAIL } from "./constants";

export const metadata = pageMetadata({
  title: "문의",
  description: "설치·회원가입 없이 즐기는 ggpli 무료 웹게임의 서비스 소개와 운영 문의. 게임 오류 제보, 개선 제안, 광고·제휴와 개인정보 관련 문의를 안내합니다.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <LegalPage title="문의">
      <p className="text-center">ggpli 이용 중 궁금한 점이나 불편한 점이 있으면 메일로 알려 주세요.</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">서비스 소개</h2>
        <p>
          ggpli는 설치·회원가입 없이 브라우저에서 즐기는 무료 웹게임 사이트입니다.
          반응속도·클릭 속도 테스트, 퍼즐과 슈팅, 친구를 초대하거나 컴퓨터와 겨루는 보드게임을 제공합니다.
          각 게임의 규칙과 조작법은 게임 목록의 공략 링크에서 확인할 수 있습니다.
        </p>
        <Link href="/games" className="inline-flex min-h-11 items-center rounded-md text-foreground underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-capybara-dark">
          게임과 공략 목록 보기
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">만드는 사람들</h2>
        <p>
          ggpli는 게임 서버와 실시간 기능까지 직접 개발하고 운영하는 웹게임 서비스입니다.
          게임을 직접 만들고 고치며, 이용 중 발견한 문제와 제안을 운영 메일로 받고 있습니다.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">운영 문의</h2>
        <p>
          이 페이지의 메일은 ggpli 운영 문의 창구입니다. 게임 오류, 공략과 실제 동작의 차이,
          개인정보 처리에 관한 질문을 보내 주세요. 오류 제보에는 게임 이름, 기기와 브라우저,
          문제가 발생한 순서를 함께 적어 주시면 확인에 도움이 됩니다.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">메일 주소</h2>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          translate="no"
          className="flex min-h-11 items-center justify-center rounded-full border-4 border-capybara bg-white/70 text-base font-semibold text-foreground transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-capybara-dark"
        >
          {CONTACT_EMAIL}
        </a>
        <p className="text-xs">오류 문의에는 게임 이름과 기기·브라우저, 문제가 발생한 상황을 함께 적어 주세요.</p>
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
        <h2 className="text-base font-semibold text-foreground">안내 변경 내역</h2>
        <p>
          <time dateTime="2026-10-08">2026년 10월 8일</time> — 개발팀 소개를 추가하고,
          운영 메일을 ai@ggpli.com으로 변경했습니다. 이용약관과 개인정보처리방침의 운영 주체 및 문의 안내를 보완했습니다.
        </p>
        <p>
          <time dateTime="2026-10-03">2026년 10월 3일</time> — 반응속도 결과의 측정 한계와 재미용 등급 안내를 보완하고,
          게임 공략의 클릭 속도 계산·통나무 회피 설명을 정정했습니다. 개인정보 안내에 서버 기록과 브라우저 기록의 차이를 반영했습니다.
        </p>
        <p>게임별 공략 페이지에서 해당 안내의 최종 수정일을 확인할 수 있습니다.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">함께 보기</h2>
        <ul className="space-y-1">
          <li>
            <Link href="/about" className="inline-flex min-h-8 items-center text-foreground underline underline-offset-2">
              회사 소개
            </Link>
          </li>
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
    </LegalPage>
  );
}
