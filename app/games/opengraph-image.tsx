import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteTitle } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteTitle("게임 목록");

export default function Image() {
  return renderOgImage({ title: "게임 목록", subtitle: "설치·로그인 없이 바로 하는 무료 미니게임 모음" });
}
