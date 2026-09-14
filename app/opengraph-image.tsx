import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteTitle } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteTitle("lobby");

export default function Image() {
  return renderOgImage({ title: "lobby", subtitle: "카피바라 마을에서 고르는 무료 미니게임" });
}
