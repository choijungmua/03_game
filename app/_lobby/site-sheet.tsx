"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { type MouseEvent, useRef, useState } from "react";

import { CONTACT_EMAIL } from "@/app/contact/constants";
import { PrivacyContent } from "@/app/privacy/privacy-content";
import { TermsContent } from "@/app/terms/terms-content";
import { cn } from "@/lib";

import { SITE_LINKS } from "./constants";

type SiteHref = (typeof SITE_LINKS)[number]["href"];

/** 패널 바탕: 카피바라 밝은 털색을 연하게 푼 크림색 */
const SHEET_BG = "bg-[color-mix(in_oklab,var(--capybara-light)_28%,white)]";

/**
 * 오른쪽 아래 사이트 정보 링크. 누르면 페이지를 떠나지 않고 아래에서 카피바라 색 패널이 올라온다.
 * 링크 주소는 그대로라 Ctrl/⌘·가운데 클릭은 원래 페이지를 새 탭으로 연다
 */
export function SiteLinks() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState<SiteHref>("/privacy");

  const openSheet = (event: MouseEvent<HTMLAnchorElement>, href: SiteHref) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    setPage(href);
    dialogRef.current?.showModal();
  };

  return (
    <>
      <nav aria-label="사이트 정보" className="flex items-center gap-3 text-caption-3 drop-shadow-md">
        {SITE_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            onClick={(event) => openSheet(event, href)}
            className={cn(
              "flex min-h-6 items-center rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary",
              // 문의는 있는 듯 없는 듯 옅게
              href === "/contact" ? "text-white/45 hover:text-white/80" : "text-white/85 hover:text-white",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* 열 때는 @starting-style에서 올라오고, 닫을 때는 display·overlay를 늦춰 내려가는 모습까지 보인다.
          글자색 토큰(foreground·muted-foreground)을 카피바라 짙은 털색으로 바꿔 본문 컴포넌트를 그대로 쓴다 */}
      <dialog
        ref={dialogRef}
        aria-labelledby="site-sheet-title"
        // 안쪽 div가 패널을 꽉 채우니, 대상이 dialog 자신이면 바깥 어두운 곳을 누른 것
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className={cn(
          "m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-3xl border-t-4 border-capybara text-foreground shadow-lg",
          SHEET_BG,
          "[--foreground:var(--capybara-dark)] [--muted-foreground:color-mix(in_oklab,var(--capybara-dark)_80%,var(--capybara-light))]",
          "translate-y-full transition-[translate,overlay,display] transition-discrete duration-300 ease-out open:translate-y-0 starting:open:translate-y-full",
          "backdrop:bg-transparent backdrop:transition-[background-color,overlay,display] backdrop:transition-discrete backdrop:duration-300 open:backdrop:bg-black/40 starting:open:backdrop:bg-transparent",
          "motion-reduce:transition-none motion-reduce:backdrop:transition-none",
        )}
      >
        <div className="max-h-[85dvh] overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-md">
            <header className={cn("sticky top-0 flex items-center justify-between pb-3 pt-4", SHEET_BG)}>
              <h2 id="site-sheet-title" className="text-title-3 font-bold">
                {SITE_LINKS.find((link) => link.href === page)?.label}
              </h2>
              <form method="dialog">
                <button
                  type="submit"
                  aria-label="닫기"
                  className="-mr-2 flex size-11 items-center justify-center rounded-full transition-colors hover:bg-capybara-light/40 focus-visible:outline-2 focus-visible:outline-capybara-dark"
                >
                  <X aria-hidden className="size-5" />
                </button>
              </form>
            </header>

            <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
              {page === "/privacy" && <PrivacyContent />}
              {page === "/terms" && <TermsContent />}
              {page === "/contact" && (
                <p>
                  궁금한 점·오류 제보·신고는{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} translate="no" className="font-semibold text-foreground underline underline-offset-2">
                    {CONTACT_EMAIL}
                  </a>
                  로 보내 주세요.
                </p>
              )}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
