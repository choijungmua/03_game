import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteTitle } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteTitle("개인정보처리방침");

export default function Image() {
  return renderOgImage({ title: "개인정보처리방침", subtitle: "ggpli가 다루는 정보와 보관 방식 안내" });
}
