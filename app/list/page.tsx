import type { Metadata } from "next";
import Link from "next/link";

import { GAMES } from "@/lib/games/registry";

export const metadata: Metadata = {
  title: "관리자 게임 목록",
  robots: { index: false, follow: false },
};

export default function ListPage() {
  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-foreground">
      <h1 className="sr-only">게임 목록</h1>
      <ul className="mx-auto max-w-md">
        {GAMES.map((game) => (
          <li key={game.slug}>
            <Link
              href={`/games/${game.slug}`}
              className="block py-3 text-title-3 font-medium text-text-strong transition-colors hover:text-primary"
            >
              {game.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
