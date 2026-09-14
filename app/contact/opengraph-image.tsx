import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteTitle } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteTitle("문의");

export default function Image() {
  return renderOgImage({ title: "문의", subtitle: "게임 오류 제보·광고·제휴 문의" });
}
