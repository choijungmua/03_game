import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteTitle } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteTitle("카피바라 게임 모음");

export default function Image() {
  return renderOgImage({ title: "카피바라 게임 모음", subtitle: "설치·로그인 없이 무료로 바로 플레이" });
}
