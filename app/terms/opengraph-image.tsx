import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteTitle } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteTitle("terms");

export default function Image() {
  return renderOgImage({ title: "terms", subtitle: "ggpli 서비스 이용약관" });
}
