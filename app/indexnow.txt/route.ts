export const dynamic = "force-static";

/** IndexNow 키 확인 파일. scripts/seo/indexnow.ts가 이 주소를 keyLocation으로 보낸다 */
export function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return new Response("Not Found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
