import type { Metadata, Viewport } from "next";

import { Toaster } from "@/components/feedback/sonner";
import { pretendard } from "@/config";
import { JsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo/site";

import "./globals.css";
import { Providers } from "./providers";

// 소유 확인 값은 공개값이라 기본값으로 둔다. 바꿀 때는 배포 환경변수로 덮어쓴다
const naverVerification = process.env.NAVER_SITE_VERIFICATION ?? "9515f491bca12bedec4cbf4d83d09b9950554a92";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // 모든 페이지 제목은 "ggpli - 페이지 이름" (lib/seo/site.ts siteTitle과 같은 모양)
  title: { default: SITE_NAME, template: `${SITE_NAME} - %s` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ko_KR",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  alternates: {
    types: { "application/rss+xml": [{ url: "/rss.xml", title: `${SITE_NAME} 게임 소식` }] },
  },
  // 구글 서치 콘솔·네이버 서치어드바이저 소유 확인
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: { "naver-site-verification": naverVerification },
  },
};

// viewport-fit=cover: 화면을 노치·다이나믹 아일랜드·홈 인디케이터 밑까지 채운다.
// 이게 없으면 iOS가 env(safe-area-inset-*)를 0으로 줘서, 가장자리 버튼·HUD의 안전 영역 여백이 전부 무시된다
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 폰트 변수는 html에 둔다: globals.css가 html에 font-sans(var(--font-pretendard))를 걸어서, body에만 두면 html에서 변수가 비어 기본 폰트로 떨어진다
    <html lang="ko" className={`${pretendard.variable} dark`} suppressHydrationWarning>
      <head>
        {/* 애드센스 사이트 확인·광고 로더. next/script는 data-nscript 속성을 붙여 애드센스가 경고하므로 일반 script를 쓴다 */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1459138523237889"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <JsonLd data={websiteJsonLd()} />
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
