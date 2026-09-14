import Link from "next/link";

import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata({
  title: "개인정보처리방침",
  description: "ggpli 개인정보처리방침",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-foreground">
      <article className="mx-auto max-w-md space-y-8 text-sm leading-relaxed text-muted-foreground">
        <header className="space-y-2">
          <Link href="/" className="inline-flex min-h-8 items-center text-xs hover:text-foreground">
            ← 홈으로
          </Link>
          <h1 className="text-2xl font-bold text-foreground">개인정보처리방침</h1>
          <p className="text-xs">시행일: 2026년 9월 14일</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">1. 수집하는 개인정보</h2>
          <p>
            ggpli(이하 “서비스”)는 회원가입이 없으며, 이름·연락처 등 이용자를 식별할 수 있는 개인정보를 직접 수집하지
            않습니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">2. 브라우저에 저장되는 정보</h2>
          <p>
            게임 기록과 순위는 이용자 기기의 브라우저 저장소(localStorage)에만 저장되며 서버로 전송되지 않습니다.
            브라우저 설정에서 사이트 데이터를 삭제하면 언제든 지울 수 있습니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">3. 광고와 쿠키</h2>
          <p>
            서비스는 Google AdSense 등 제3자 광고 서비스를 이용할 수 있습니다. 광고 제공업체는 쿠키를 사용해 이용자의
            이 사이트 및 다른 사이트 방문 기록을 바탕으로 광고를 표시할 수 있습니다.
          </p>
          <p>
            맞춤 광고는{" "}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-2"
            >
              Google 광고 설정
            </a>
            에서 끄거나, 브라우저 설정에서 쿠키를 차단할 수 있습니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">4. 접속 기록</h2>
          <p>
            서비스 운영과 보안을 위해 호스팅 환경에서 IP 주소, 브라우저 종류, 접속 시각 등 기본 접속 기록이 자동으로
            생성될 수 있으며, 이는 장애 대응 목적 외에는 사용하지 않습니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">5. 로비 채팅과 위치 정보</h2>
          <p>
            로비에서 다른 이용자와 함께 보이도록 캐릭터 위치·옷차림·채팅 내용이 서버로 전송됩니다. 이 정보는 서버
            메모리에만 잠시 머물며, 채팅은 약 5초 뒤, 접속 정보는 연결이 끊기고 약 10초 뒤 사라지고 따로 저장하지
            않습니다. 채팅에 이름·연락처 등 개인정보를 적지 마세요.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">6. 문의</h2>
          <p>
            개인정보와 관련한 문의는{" "}
            <Link href="/contact" className="text-foreground underline underline-offset-2">
              문의 페이지
            </Link>
            의 메일 주소로 보내 주세요.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">7. 방침 변경</h2>
          <p>이 방침이 변경되면 이 페이지에 시행일과 함께 게시합니다.</p>
        </section>
      </article>
    </main>
  );
}
