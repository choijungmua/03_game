import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { SITE_NAME } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };

/** 사이트 카피바라 아이콘 (파비콘 원본과 같은 그림) */
const SITE_ICON = "app/icon.png";

/** 게임 아이콘 원본 PNG. 공유 이미지 렌더러는 webp를 못 읽어서 assets-src 원본을 쓰고, 없으면 사이트 아이콘 */
export function gameIconPath(slug: string) {
  const path = `assets-src/games/${slug}/icon.png`;
  return existsSync(join(process.cwd(), path)) ? path : SITE_ICON;
}

/**
 * 이미지에 들어갈 글자만 담은 Noto Sans KR 조각을 받는다 (OG 렌더러는 woff2인 Pretendard를 못 읽는다).
 * 빌드 환경에서 받지 못하면 null — 글자 없이 아이콘만 그린다
 */
async function loadFont(text: string) {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl)).text();
    const fontUrl = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!fontUrl) return null;
    return await (await fetch(fontUrl)).arrayBuffer();
  } catch {
    return null;
  }
}

interface OgImageInput {
  /** 페이지 이름 (예: 로비, 반응속도 테스트) */
  title: string;
  subtitle: string;
  /** 프로젝트 루트 기준 PNG 경로 */
  icon?: string;
}

/** 공유 카드. CSS 토큰을 못 쓰는 렌더러라 다크 테마 색을 직접 적는다 */
export async function renderOgImage({ title, subtitle, icon = SITE_ICON }: OgImageInput) {
  const [font, iconData] = await Promise.all([
    loadFont(`${SITE_NAME}${title}${subtitle}`),
    readFile(join(process.cwd(), icon), "base64"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          gap: 64,
          padding: "0 88px",
          background: "#141416",
          color: "#fafafa",
          fontFamily: "Noto Sans KR",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- OG 렌더러는 img만 받는다 */}
        <img
          src={`data:image/png;base64,${iconData}`}
          width={320}
          height={320}
          alt=""
          style={{ objectFit: "contain" }}
        />
        {font && (
          <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 34, color: "#6ea8fe" }}>{SITE_NAME}</div>
            {/* 한글 제목이 글자 단위로 끊겨 한 글자만 다음 줄로 넘어가지 않게 단어 단위로 줄바꿈 */}
            <div style={{ fontSize: 66, lineHeight: 1.25, wordBreak: "keep-all" }}>{title}</div>
            <div style={{ fontSize: 34, lineHeight: 1.4, color: "#a1a1aa", wordBreak: "keep-all" }}>{subtitle}</div>
          </div>
        )}
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: font ? [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }] : undefined,
    },
  );
}
