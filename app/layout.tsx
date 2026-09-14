import type { Metadata } from "next";

import { Toaster } from "@/components/feedback/sonner";
import { pretendard } from "@/config";
import { JsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo/site";

import "./globals.css";
import { Providers } from "./providers";

const naverVerification = process.env.NAVER_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} - ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ko_KR",
    title: `${SITE_NAME} - ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  alternates: {
    types: { "application/rss+xml": [{ url: "/rss.xml", title: `${SITE_NAME} 게임 소식` }] },
  },
  // 구글 서치 콘솔·네이버 서치어드바이저 소유 확인. 값은 배포 환경변수로 넣는다
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: naverVerification ? { "naver-site-verification": naverVerification } : undefined,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <head>
        {/* 애드센스 사이트 확인·광고 로더. next/script는 data-nscript 속성을 붙여 애드센스가 경고하므로 일반 script를 쓴다 */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1459138523237889"
          crossOrigin="anonymous"
        />
      </head>
      <body className={pretendard.variable}>
        <JsonLd data={websiteJsonLd()} />
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
