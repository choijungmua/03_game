import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteTitle } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteTitle("about");

export default function Image() {
  return renderOgImage({ title: "about", subtitle: "ggpli를 만드는 회사와 팀 소개" });
}
