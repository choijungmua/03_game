// lib/games/registry.ts(코드)의 게임 목록을 Supabase g_game 테이블에 upsert한다
// 게임을 registry에 추가한 뒤 실행: pnpm games:sync  (입장 수 visit_count는 건드리지 않음)
import { register } from "node:module";

// registry.ts의 next/dynamic은 Node에서 못 불러오므로 빈 함수로 바꿔 slug·title만 읽는다.
// 확장자 없는 상대 import(./constants)는 Node ESM이 못 찾으므로 .ts를 붙여준다
register(
  `data:text/javascript,${encodeURIComponent(`export async function resolve(specifier, context, next) {
  if (specifier === "next/dynamic") return { url: "data:text/javascript,export default () => null", shortCircuit: true };
  if (/^\\.{1,2}\\//.test(specifier) && !/\\.[cm]?[jt]sx?$/.test(specifier)) return next(specifier + ".ts", context);
  return next(specifier, context);
}`)}`,
);

const { GAMES } = await import("../lib/games/registry.ts");
const rows = GAMES.map(({ slug, title }) => ({ slug, title }));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.log(JSON.stringify(rows, null, 2));
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY가 없어 목록만 출력했습니다 (.env.local 확인)");
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/g_game?on_conflict=slug`, {
  method: "POST",
  headers: {
    apikey: key,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  },
  body: JSON.stringify(rows),
});
if (!res.ok) {
  console.error(`동기화 실패 ${res.status}: ${await res.text()}`);
  process.exit(1);
}
console.log(`g_game ${rows.length}개 동기화 완료`);
