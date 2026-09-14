import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteTitle } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteTitle("이용약관");

export default function Image() {
  return renderOgImage({ title: "이용약관", subtitle: "ggpli 서비스 이용 규칙 안내" });
}
