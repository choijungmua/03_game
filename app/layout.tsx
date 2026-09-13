import type { Metadata } from "next";

import { Toaster } from "@/components/feedback/sonner";
import { pretendard } from "@/config";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "03 Game",
  description: "03 Game interface",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <body className={pretendard.variable}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
