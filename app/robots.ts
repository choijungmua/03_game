import type { MetadataRoute } from "next";

import { absoluteUrl, SITE_URL } from "@/lib/seo/site";

// 네이버(Yeti)·구글·AI 검색 크롤러 모두 허용. API만 막는다
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
