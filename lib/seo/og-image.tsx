import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { SITE_NAME } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };

const iconSrc = `data:image/png;base64,${await readFile(join(process.cwd(), "app/icon.png"), "base64")}`;

/**
 * 이미지에 들어갈 글자만 담은 Noto Sans KR 조각을 받는다 (OG 렌더러는 woff2인 Pretendard를 못 읽는다).
 * 빌드 환경에서 받지 못하면 null — 글자 없이 카피바라만 그린다
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

/** 공유 카드. CSS 토큰을 못 쓰는 렌더러라 다크 테마 색을 직접 적는다 */
export async function renderOgImage({ title, subtitle }: { title: string; subtitle: string }) {
  const font = await loadFont(`${title}${subtitle}${SITE_NAME}`);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          gap: 56,
          padding: "0 88px",
          background: "#141416",
          color: "#fafafa",
          fontFamily: "Noto Sans KR",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- OG 렌더러는 img만 받는다 */}
        <img src={iconSrc} width={300} height={300} alt="" />
        {font && (
          <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 20 }}>
            {/* 한글 제목이 글자 단위로 끊겨 한 글자만 다음 줄로 넘어가지 않게 단어 단위로 줄바꿈 */}
            <div style={{ fontSize: 66, lineHeight: 1.25, wordBreak: "keep-all" }}>{title}</div>
            <div style={{ fontSize: 36, lineHeight: 1.4, color: "#a1a1aa" }}>{subtitle}</div>
            <div style={{ fontSize: 32, color: "#6ea8fe" }}>{SITE_NAME}</div>
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
