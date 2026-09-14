import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = `${SITE_NAME} ${SITE_TAGLINE}`;

export default function Image() {
  return renderOgImage({ title: SITE_TAGLINE, subtitle: "설치·로그인 없이 브라우저에서 바로 플레이" });
}
