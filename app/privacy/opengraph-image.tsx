import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { siteTitle } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = siteTitle("privacy");

export default function Image() {
  return renderOgImage({ title: "privacy", subtitle: "ggpli 개인정보처리방침" });
}
