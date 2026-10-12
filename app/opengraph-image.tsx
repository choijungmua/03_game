import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteTitle } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteTitle("카피바라 마을");

export default function Image() {
  return renderOgImage({ title: "카피바라 마을", subtitle: "산책·낚시와 무료 카피바라 게임을 한곳에서" });
}
