import Link from "next/link";

import { pageMetadata } from "@/lib/seo/site";

import { TermsContent } from "./terms-content";

export const metadata = pageMetadata({
  title: "terms",
  description: "ggpli 서비스 이용약관",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-foreground">
      <article className="mx-auto max-w-md space-y-8 text-sm leading-relaxed text-muted-foreground">
        <header className="space-y-2">
          <Link href="/" className="inline-flex min-h-8 items-center text-xs hover:text-foreground">
            ← 홈으로
          </Link>
          <h1 className="text-2xl font-bold text-foreground">이용약관</h1>
        </header>

        <TermsContent />
      </article>
    </main>
  );
}
