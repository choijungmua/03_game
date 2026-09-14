import Link from "next/link";

import { pageMetadata } from "@/lib/seo/site";

import { PrivacyContent } from "./privacy-content";

export const metadata = pageMetadata({
  title: "privacy",
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
        </header>

        <PrivacyContent />
      </article>
    </main>
  );
}
