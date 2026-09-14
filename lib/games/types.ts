import type { ComponentType } from "react";

export type RetryTier = "S" | "A" | "B" | "C";
export type PlayDifficulty = "쉬움" | "보통" | "어려움";

export interface GameEntry {
  slug: string;
  title: string;
  description: string;
  tier: RetryTier;
  playDifficulty: PlayDifficulty;
  component: ComponentType;
  /** 게임 폴더의 seo.ts. 서버(메타데이터·sitemap·가이드)에서만 필요할 때 불러온다 */
  seo: () => Promise<{ seo: GameSeo }>;
}

export interface GameFaq {
  question: string;
  answer: string;
}

export interface GameGuideSection {
  heading: string;
  body: string;
}

/** 게임별 검색 노출 문구. `pnpm seo:generate <slug>`로 만들고 사람이 검토한다 */
export interface GameSeo {
  /** 게임 페이지 검색 결과 설명 (80~160자) */
  metaDescription: string;
  /** 가이드 페이지 검색 결과 설명. 게임 페이지와 겹치지 않게 쓴다 */
  guideDescription: string;
  /** 대표 검색어 먼저, 연관·롱테일 검색어 순 */
  keywords: string[];
  /** 게임 아래 짧은 소개 (2~3문장) */
  intro: string;
  howToPlay: string[];
  tips: string[];
  faq: GameFaq[];
  /** 가이드 페이지 본문 */
  guide: GameGuideSection[];
  /** YYYY-MM-DD. sitemap lastModified */
  updatedAt: string;
}
