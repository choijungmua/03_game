import type { Metadata } from "next";

import { Toaster } from "@/components/feedback/sonner";
import { pretendard } from "@/config";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "ggpli",
  description: "ggpli 게임 모음",
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
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
