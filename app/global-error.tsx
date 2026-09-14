"use client";

import "./globals.css";

import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/inputs/button";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

/**
 * 루트 레이아웃까지 에러가 났을 때 문서 전체를 대신한다.
 * 루트 레이아웃이 없으므로 html·body·전역 스타일·다크 테마를 여기서 직접 넣는다
 */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko" className="dark">
      <body className="bg-background text-text-strong">
        <title>ggpli - 문제가 생겼어요</title>
        <main className="flex h-dvh w-full flex-col items-center justify-center gap-6 px-4 text-center">
          <div className="flex max-w-md flex-col gap-2">
            <h1 className="text-title-1 font-black">문제가 생겼어요</h1>
            <p className="text-base text-text-caption">
              잠깐 오류가 났어요. 다시 시도해도 계속되면 처음 화면으로 돌아가 주세요.
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button type="button" onClick={retry} className="h-12 w-full text-title-3 font-bold">
              다시 시도
            </Button>
            <Link href="/" className={buttonVariants({ variant: "outline", className: "h-12 w-full" })}>
              처음으로
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
