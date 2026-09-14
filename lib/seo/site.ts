import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ggpli.com";
export const SITE_NAME = "ggpli";
export const SITE_TAGLINE = "무료 미니게임 모음";
export const SITE_DESCRIPTION =
  "설치·로그인 없이 브라우저에서 바로 하는 무료 미니게임 모음. 반응속도 테스트, 클릭 속도 테스트, 카피바라 슈팅·통나무 피하기, 친구와 초대 코드로 하는 온라인 바둑·오목·알까기까지.";

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}

/** 페이지별 메타데이터. openGraph는 부모와 합쳐지지 않고 통째로 바뀌므로 사이트 공통값까지 매번 채운다 */
export function pageMetadata({ title, description, path, keywords }: PageMetadataInput): Metadata {
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "ko_KR",
      url: path,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
