"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/inputs/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  retry: () => void;
}

/** 페이지(게임 포함)를 그리다 에러가 나면 빈 화면·멈춘 화면 대신 보여 준다. 루트 레이아웃은 그대로 남는다 */
export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background px-4 text-center text-text-strong">
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
  );
}
