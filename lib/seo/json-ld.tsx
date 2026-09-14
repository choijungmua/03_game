import type { GameEntry, GameSeo } from "@/lib/games/types";

import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./site";

export type JsonLdValue = string | number | boolean | null | JsonLdValue[] | { [key: string]: JsonLdValue };
type JsonLdObject = { [key: string]: JsonLdValue };

/** 구조화 데이터 script. `<`를 이스케이프해 문자열 속 태그로 script가 끊기지 않게 한다 */
export function JsonLd({ data }: { data: JsonLdObject }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const publisher = { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: absoluteUrl("/icon.png") };

export function websiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "ko",
    publisher,
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

type GameSummary = Pick<GameEntry, "slug" | "title">;

/** 구글 소프트웨어 앱 리치결과는 WebApplication 타입을 보므로 VideoGame과 함께 쓴다 */
export function gameJsonLd(game: GameSummary, seo: GameSeo): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": ["VideoGame", "WebApplication"],
    name: game.title,
    description: seo.metaDescription,
    url: absoluteUrl(`/games/${game.slug}`),
    image: absoluteUrl(`/games/${game.slug}/opengraph-image`),
    inLanguage: "ko",
    applicationCategory: "GameApplication",
    operatingSystem: "Web browser",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: 0, priceCurrency: "KRW" },
    keywords: seo.keywords.join(", "),
    dateModified: seo.updatedAt,
    publisher,
  };
}

export function guideJsonLd(game: GameSummary, seo: GameSeo, title: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: seo.guideDescription,
    url: absoluteUrl(`/games/${game.slug}/guide`),
    image: absoluteUrl(`/games/${game.slug}/opengraph-image`),
    inLanguage: "ko",
    dateModified: seo.updatedAt,
    author: publisher,
    publisher,
    about: { "@type": "VideoGame", name: game.title, url: absoluteUrl(`/games/${game.slug}`) },
  };
}
