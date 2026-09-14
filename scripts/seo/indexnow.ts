/**
 * 배포 후 즉시 색인 요청
 *   pnpm seo:indexnow
 *
 * 배포된 sitemap.xml의 URL을 IndexNow로 보낸다. api.indexnow.org는 받은 URL을
 * 네이버·빙 등 참여 검색엔진에 함께 전달한다. 구글은 IndexNow를 지원하지 않아 서치 콘솔 sitemap으로 수집된다.
 */
import { SITE_URL } from "../../lib/seo/site.ts";

import { fail } from "./common.ts";

const key = process.env.INDEXNOW_KEY;
if (!key) fail("INDEXNOW_KEY가 없습니다. 8~128자 영문·숫자 키를 만들어 .env.local과 배포 환경변수에 같은 값으로 넣어 주세요");

const sitemap = await (await fetch(`${SITE_URL}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
if (urlList.length === 0) fail(`${SITE_URL}/sitemap.xml에서 URL을 찾지 못했습니다`);

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE_URL).host, key, keyLocation: `${SITE_URL}/indexnow.txt`, urlList }),
});
console.log(`IndexNow ${response.status} — URL ${urlList.length}개 전송`);
if (!response.ok) fail(await response.text());
