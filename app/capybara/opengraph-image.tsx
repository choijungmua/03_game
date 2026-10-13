import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteTitle } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteTitle("카피바라의 특징·먹이·서식지");

export default function Image() {
  return renderOgImage({ title: "카피바라는 어떤 동물일까요?", subtitle: "특징·먹이·서식지와 물가의 생활" });
}
