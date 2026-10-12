import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteTitle } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteTitle("무료 미니게임");

export default function Image() {
  return renderOgImage({ title: "무료 미니게임", subtitle: "카피바라 마을에서 고르는 무료 미니게임" });
}
