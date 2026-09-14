// 카피바라 비행기 슈팅 스프라이트 생성기 — 카피바라가 사는 습지 세계 테마
// SVG 원본(이 폴더의 <분류>/*.svg)을 만들고 public 아래 webp로 변환한다.
// 실행: node assets-src/games/capybara-plane-shooter/build-sprites.mjs
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
// sharp는 next가 이미 설치해 둔 것을 쓴다 (새 의존성 추가 없음)
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SRC_DIR, "../../..");
const OUT_DIR = path.join(ROOT, "public/assets/images/games/capybara-plane-shooter");

const OUTLINE = "#1a1733";

const C = {
  fur: "#b27b4b",
  furDark: "#7d5230",
  snout: "#8c5b36",
  earInner: "#d9a57a",
  goggle: "#3a2a1c",
  lens: "#9fe6ff",
  plane: "#4f7cff",
  planeDark: "#2d4fc4",
  planeLight: "#a9c1ff",
  accent: "#ffd23f",
  yuzu: "#ffb627",
  leaf: "#7ed957",
  leafDark: "#3f8f3a",
  orange: "#ff9f1c",
  corn: "#ffd23f",
  cane: "#b5d96a",
};

function svg(width, height, body, defs = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${body}</svg>`;
}

/** 빌드할 때마다 같은 그림이 나오도록 시드 고정 난수를 쓴다 */
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 피격 버전: 알파는 그대로 두고 색만 흰색 쪽으로 밀어 번쩍이는 느낌을 만든다 */
const HIT_FILTER = `<filter id="hit" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="0.35" intercept="0.65"/><feFuncG type="linear" slope="0.35" intercept="0.65"/><feFuncB type="linear" slope="0.35" intercept="0.65"/></feComponentTransfer></filter>`;

function withHit(width, height, body, defs = "") {
  return svg(width, height, `<g filter="url(#hit)">${body}</g>`, defs + HIT_FILTER);
}

const mirror = (width, body) => `<g transform="matrix(-1 0 0 1 ${width} 0)">${body}</g>`;

// ---------- 공용 사물 (무기 탄과 아이템 아이콘이 같은 사물을 다른 구도로 그린다) ----------

/** 끝이 뾰족한 잎/씨앗 모양 */
const pointed = (cx, cy, w, h) =>
  `M${cx} ${cy - h / 2} C${cx + w / 2} ${cy - h / 4} ${cx + w / 2} ${cy + h / 4} ${cx} ${cy + h / 2} C${cx - w / 2} ${cy + h / 4} ${cx - w / 2} ${cy - h / 4} ${cx} ${cy - h / 2} Z`;

// ---------- 비행기 (카피바라 조종사, 머리에 유자) ----------

/** 맞았을 때: 고글 속 눈이 빙글빙글, 머리에 붕대, 별이 돌고 날개에서 연기 */
const DIZZY = `
  <path d="M59 50 m-1.5 0 a1.5 1.5 0 1 1 1.5 1.5 a3 3 0 1 1 -3 -3" stroke="${OUTLINE}" stroke-width="1.2" fill="none"/>
  <path d="M69 50 m-1.5 0 a1.5 1.5 0 1 1 1.5 1.5 a3 3 0 1 1 -3 -3" stroke="${OUTLINE}" stroke-width="1.2" fill="none"/>
  <rect x="68" y="40" width="10" height="4" rx="1" fill="#ffffff" stroke="${OUTLINE}" stroke-width="1" transform="rotate(35 73 42)"/>
  <rect x="68" y="40" width="10" height="4" rx="1" fill="#ffffff" stroke="${OUTLINE}" stroke-width="1" transform="rotate(-35 73 42)"/>
  <path d="M40 30 l2 -5 l2 5 l5 1 l-5 2 l-2 5 l-2 -5 l-5 -2 z" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="1"/>
  <path d="M86 26 l1.6 -4 l1.6 4 l4 0.8 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 z" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="1"/>
  <circle cx="98" cy="88" r="7" fill="#9a9fab" opacity="0.8"/><circle cx="107" cy="97" r="5" fill="#b8bcc6" opacity="0.7"/>`;

/** bank: -1 왼쪽으로 기울기, 0 수평, 1 오른쪽. 기우는 쪽 날개가 짧고 낮아 보인다 */
function plane(bank, hurt = false) {
  const wing = (side) => {
    const dips = side === bank;
    const rises = side === -bank && bank !== 0;
    const span = dips ? 40 : rises ? 60 : 56;
    const drop = dips ? 6 : rises ? -3 : 0;
    const tipX = 64 + side * span;
    const rootX = 64 + side * 8;
    return `<path d="M${rootX} ${54 + drop / 2} L${tipX} ${72 + drop} L${tipX - side * 2} ${84 + drop} L${rootX} ${80 + drop / 2} Z" fill="${dips ? C.planeDark : C.plane}" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M${64 + side * (span - 10)} ${70 + drop} L${tipX - side * 1} ${73 + drop} L${tipX - side * 2} ${81 + drop} L${64 + side * (span - 12)} ${80 + drop} Z" fill="${C.accent}"/>`;
  };
  const tail = (side) =>
    `<path d="M${64 + side * 6} 96 L${64 + side * 24} 104 L${64 + side * 23} 111 L${64 + side * 6} 109 Z" fill="${C.planeDark}" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>`;

  const body = `
    <g transform="rotate(${bank * 6} 64 64)">
      ${wing(-1)}${wing(1)}${tail(-1)}${tail(1)}
      <path d="M64 8 C79 20 81 58 77 96 C75 112 53 112 51 96 C47 58 49 20 64 8 Z" fill="${C.plane}" stroke="${OUTLINE}" stroke-width="3"/>
      <path d="M64 12 C71 20 73 40 72 60 L64 60 Z" fill="${C.planeLight}" opacity="0.55"/>
      <rect x="58" y="104" width="12" height="8" rx="2" fill="#2a2d3e" stroke="${OUTLINE}" stroke-width="2"/>
      <path d="M52 34 Q64 24 76 34 L74 40 Q64 33 54 40 Z" fill="${C.lens}" stroke="${OUTLINE}" stroke-width="2"/>
      <ellipse cx="64" cy="54" rx="14" ry="17" fill="#20264a" stroke="${OUTLINE}" stroke-width="2.5"/>
      <circle cx="55" cy="60" r="4" fill="${C.furDark}"/>
      <circle cx="73" cy="60" r="4" fill="${C.furDark}"/>
      <circle cx="55" cy="60" r="2" fill="${C.earInner}"/>
      <circle cx="73" cy="60" r="2" fill="${C.earInner}"/>
      <ellipse cx="64" cy="50" rx="11" ry="13" fill="${C.fur}" stroke="${OUTLINE}" stroke-width="2"/>
      <ellipse cx="64" cy="41" rx="8" ry="6" fill="${C.snout}"/>
      <ellipse cx="61" cy="39" rx="1.4" ry="1" fill="#2a1a10"/>
      <ellipse cx="67" cy="39" rx="1.4" ry="1" fill="#2a1a10"/>
      <rect x="52" y="48" width="24" height="4" fill="${C.goggle}"/>
      <circle cx="59" cy="50" r="4" fill="${C.lens}" stroke="${C.goggle}" stroke-width="2"/>
      <circle cx="69" cy="50" r="4" fill="${C.lens}" stroke="${C.goggle}" stroke-width="2"/>
      ${hurt ? DIZZY : `<circle cx="58" cy="49" r="1.2" fill="#fff"/><circle cx="68" cy="49" r="1.2" fill="#fff"/>`}
      <circle cx="64" cy="59" r="5.5" fill="${C.yuzu}" stroke="${OUTLINE}" stroke-width="1.5"/>
      <path d="M64 54 Q68 50 71 52 Q68 56 64 54 Z" fill="${C.leaf}" stroke="${OUTLINE}" stroke-width="1"/>
    </g>`;
  return svg(128, 128, body);
}

/** 불꽃 2프레임: 길고 뾰족한 불꽃과 짧고 끝이 갈라진 불꽃을 번갈아 보여준다 */
function flame(length, fork) {
  const outer = fork
    ? `M24 2 C40 8 36 ${length * 0.6} 30 ${length} L24 ${length - 10} L18 ${length} C12 ${length * 0.6} 8 8 24 2 Z`
    : `M24 2 C40 8 38 ${length * 0.5} 24 ${length} C10 ${length * 0.5} 8 8 24 2 Z`;
  const body = `
    <path d="${outer}" fill="#ff7a2f"/>
    <path d="M24 4 C34 10 33 22 24 ${length * 0.72} C15 22 14 10 24 4 Z" fill="#ffd23f"/>
    <ellipse cx="24" cy="10" rx="5" ry="7" fill="#fffbe6"/>`;
  return svg(48, 64, body);
}

// ---------- 적: 카피바라의 천적들 (모두 아래를 향한다) ----------

/** 하피독수리: 날개를 펴고 곧장 내리꽂는다 */
function harpyEagle() {
  const wing = `
    <path d="M40 38 C28 30 14 24 4 24 L10 34 L6 40 L16 44 L12 50 L24 50 L22 56 L36 52 Z" fill="#5b606d" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M36 42 C26 38 16 34 9 33" stroke="#8a909c" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return `
    <path d="M40 30 L35 7 L48 13 L61 7 L56 30 Z" fill="#3d414b" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M40 16 L56 16 M41 22 L55 22" stroke="#8a909c" stroke-width="2"/>
    ${wing}${mirror(96, wing)}
    <ellipse cx="48" cy="44" rx="13" ry="20" fill="#4a4f5c" stroke="${OUTLINE}" stroke-width="3"/>
    <ellipse cx="48" cy="53" rx="8" ry="10" fill="#e6e8ec"/>
    <path d="M38 64 L33 55 L43 60 Z M58 64 L63 55 L53 60 Z" fill="#3d414b" stroke="${OUTLINE}" stroke-width="1.5"/>
    <circle cx="48" cy="70" r="11" fill="#eef0f3" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="43" cy="70" r="3" fill="#ffd23f"/><circle cx="43" cy="70.5" r="1.5" fill="${OUTLINE}"/>
    <circle cx="53" cy="70" r="3" fill="#ffd23f"/><circle cx="53" cy="70.5" r="1.5" fill="${OUTLINE}"/>
    <path d="M38 65 L46 68 M58 65 L50 68" stroke="${OUTLINE}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M44 76 L52 76 L50 86 Q48 91 46 86 Z" fill="#2f2f36" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>`;
}

/** 말벌: 좌우로 붕붕 흔들리며 내려온다 */
function wasp() {
  return `
    <defs><clipPath id="abdomen"><ellipse cx="48" cy="30" rx="14" ry="20"/></clipPath></defs>
    <ellipse cx="28" cy="38" rx="19" ry="9" transform="rotate(-25 28 38)" fill="#e6f6ff" opacity="0.75" stroke="#9ec9dd" stroke-width="2"/>
    <ellipse cx="68" cy="38" rx="19" ry="9" transform="rotate(25 68 38)" fill="#e6f6ff" opacity="0.75" stroke="#9ec9dd" stroke-width="2"/>
    <ellipse cx="30" cy="51" rx="14" ry="7" transform="rotate(-8 30 51)" fill="#e6f6ff" opacity="0.6" stroke="#9ec9dd" stroke-width="2"/>
    <ellipse cx="66" cy="51" rx="14" ry="7" transform="rotate(8 66 51)" fill="#e6f6ff" opacity="0.6" stroke="#9ec9dd" stroke-width="2"/>
    <path d="M44 12 L48 1 L52 12 Z" fill="#2a2a2a"/>
    <ellipse cx="48" cy="30" rx="14" ry="20" fill="#ffcf24"/>
    <g clip-path="url(#abdomen)"><rect x="30" y="16" width="36" height="6" fill="#2a2a2a"/><rect x="30" y="28" width="36" height="6" fill="#2a2a2a"/><rect x="30" y="40" width="36" height="5" fill="#2a2a2a"/></g>
    <ellipse cx="48" cy="30" rx="14" ry="20" fill="none" stroke="${OUTLINE}" stroke-width="3"/>
    <ellipse cx="48" cy="54" rx="10" ry="8" fill="#2a2a2a" stroke="${OUTLINE}" stroke-width="2.5"/>
    <path d="M44 74 Q39 82 33 84 M52 74 Q57 82 63 84" stroke="${OUTLINE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <circle cx="48" cy="66" r="10" fill="#ffcf24" stroke="${OUTLINE}" stroke-width="3"/>
    <ellipse cx="43" cy="66" rx="3.5" ry="4.5" fill="${OUTLINE}"/><ellipse cx="53" cy="66" rx="3.5" ry="4.5" fill="${OUTLINE}"/>
    <circle cx="42" cy="64.5" r="1.2" fill="#fff"/><circle cx="52" cy="64.5" r="1.2" fill="#fff"/>
    <path d="M45 72 L48 75 L51 72" stroke="${OUTLINE}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
}

/** 재규어: 프로펠러 드론에 매달려 천천히 내려오며 바람총으로 가시 열매를 쏜다 */
function jaguar() {
  const rosette = (x, y) =>
    `<circle cx="${x}" cy="${y}" r="4.2" fill="none" stroke="#5a3510" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="1.3" fill="#5a3510"/>`;
  return `
    <circle cx="14" cy="48" r="13" fill="#c9ced8" opacity="0.45"/><circle cx="14" cy="48" r="3" fill="${OUTLINE}"/>
    <circle cx="98" cy="48" r="13" fill="#c9ced8" opacity="0.45"/><circle cx="98" cy="48" r="3" fill="${OUTLINE}"/>
    <rect x="14" y="45" width="84" height="7" rx="3" fill="#3b4252" stroke="${OUTLINE}" stroke-width="2"/>
    <path d="M26 30 L30 7 L48 21 Z M86 30 L82 7 L64 21 Z" fill="#e8a33d" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M31 25 L33 14 L42 21 Z M81 25 L79 14 L70 21 Z" fill="#f6d9a8"/>
    <circle cx="56" cy="48" r="32" fill="#e8a33d" stroke="${OUTLINE}" stroke-width="3"/>
    ${rosette(34, 36)}${rosette(46, 25)}${rosette(67, 25)}${rosette(79, 37)}${rosette(30, 56)}${rosette(82, 57)}
    <ellipse cx="56" cy="64" rx="17" ry="12" fill="#fbe8c8"/>
    <rect x="51" y="68" width="10" height="40" rx="3" fill="#8b5a2b" stroke="${OUTLINE}" stroke-width="3"/>
    <rect x="50" y="100" width="12" height="6" rx="2" fill="#c0392b"/>
    <path d="M46 70 Q56 74 66 70" stroke="${OUTLINE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M50 56 L62 56 L56 63 Z" fill="#3a2418"/>
    <ellipse cx="42" cy="45" rx="6.5" ry="5" fill="#9be15d" stroke="${OUTLINE}" stroke-width="2"/>
    <ellipse cx="70" cy="45" rx="6.5" ry="5" fill="#9be15d" stroke="${OUTLINE}" stroke-width="2"/>
    <rect x="41" y="41" width="2.4" height="8" rx="1.2" fill="${OUTLINE}"/><rect x="69" y="41" width="2.4" height="8" rx="1.2" fill="${OUTLINE}"/>
    <path d="M33 36 L48 41 M79 36 L64 41" stroke="${OUTLINE}" stroke-width="3.5" stroke-linecap="round"/>`;
}

/** 아르마딜로(방패병): 비늘 등딱지를 두르고, 머리 방패판으로 아래에서 오는 총알을 막는다 */
function armadillo() {
  const band = (y, w) => `<path d="M${48 - w} ${y} Q48 ${y + 7} ${48 + w} ${y}" stroke="#6b5440" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return `
    <path d="M44 20 L48 3 L52 20 Z" fill="#8f7a64" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="22" cy="44" rx="7" ry="5" fill="#d4b596" stroke="${OUTLINE}" stroke-width="2.5"/>
    <ellipse cx="74" cy="44" rx="7" ry="5" fill="#d4b596" stroke="${OUTLINE}" stroke-width="2.5"/>
    <ellipse cx="48" cy="42" rx="30" ry="26" fill="#b89a7a" stroke="${OUTLINE}" stroke-width="3"/>
    ${band(28, 22)}${band(38, 28)}${band(48, 28)}${band(58, 22)}
    <ellipse cx="48" cy="42" rx="30" ry="26" fill="none" stroke="${OUTLINE}" stroke-width="3"/>
    <ellipse cx="37" cy="68" rx="5" ry="7" fill="#d4b596" stroke="${OUTLINE}" stroke-width="2.5"/>
    <ellipse cx="59" cy="68" rx="5" ry="7" fill="#d4b596" stroke="${OUTLINE}" stroke-width="2.5"/>
    <path d="M36 66 Q48 60 60 66 L53 88 Q48 94 43 88 Z" fill="#d4b596" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M37 66 Q48 58 59 66 L56 74 Q48 69 40 74 Z" fill="#8f7a64" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="43" cy="77" r="2.6" fill="${OUTLINE}"/><circle cx="53" cy="77" r="2.6" fill="${OUTLINE}"/>
    <circle cx="42.3" cy="76.2" r="0.9" fill="#fff"/><circle cx="52.3" cy="76.2" r="0.9" fill="#fff"/>
    <ellipse cx="48" cy="90" rx="3" ry="2" fill="#5a3a2a"/>`;
}

/** 칼새(돌진병): 뒤로 젖힌 날카로운 날개. 멈춰서 노려보다 곧장 내리꽂는다 */
function swift() {
  const wing = `<path d="M44 38 C30 28 14 18 3 16 C14 30 26 44 42 56 Z" fill="#3a4a6b" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M40 42 C30 34 20 27 11 22" stroke="#6d80a8" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  return `
    <path d="M42 16 L35 2 L48 10 L61 2 L54 16 Z" fill="#2f3b57" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
    ${wing}${mirror(96, wing)}
    <path d="M48 8 C59 24 59 60 48 86 C37 60 37 24 48 8 Z" fill="#2f3b57" stroke="${OUTLINE}" stroke-width="3"/>
    <ellipse cx="48" cy="58" rx="6" ry="14" fill="#e9eef7"/>
    <circle cx="43" cy="72" r="3.4" fill="#ff5a5a" stroke="${OUTLINE}" stroke-width="1.5"/><circle cx="43" cy="72.6" r="1.4" fill="${OUTLINE}"/>
    <circle cx="53" cy="72" r="3.4" fill="#ff5a5a" stroke="${OUTLINE}" stroke-width="1.5"/><circle cx="53" cy="72.6" r="1.4" fill="${OUTLINE}"/>
    <path d="M38 67 L45 70 M58 67 L51 70" stroke="${OUTLINE}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M45 80 L51 80 L48 93 Z" fill="#f2b233" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>`;
}

/** 독화살개구리(분열체): 파란 몸에 검은 점. 격추하면 작은 개구리 둘로 갈라진다 */
function dartFrog() {
  const hind = `<path d="M30 30 Q12 20 8 6 Q22 12 34 24 Z" fill="#1f7ae0" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>`;
  const fore = `<path d="M30 60 Q16 70 13 84 Q24 78 35 67 Z" fill="#1f7ae0" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>`;
  return `
    ${hind}${mirror(96, hind)}${fore}${mirror(96, fore)}
    <ellipse cx="48" cy="46" rx="26" ry="28" fill="#2d8cff" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="38" cy="33" r="5" fill="#16213a"/><circle cx="58" cy="29" r="4" fill="#16213a"/>
    <circle cx="52" cy="48" r="6" fill="#16213a"/><circle cx="35" cy="54" r="4" fill="#16213a"/><circle cx="63" cy="55" r="3" fill="#16213a"/>
    <circle cx="37" cy="66" r="8" fill="#2d8cff" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="59" cy="66" r="8" fill="#2d8cff" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="37" cy="67" r="4" fill="${OUTLINE}"/><circle cx="59" cy="67" r="4" fill="${OUTLINE}"/>
    <circle cx="35.8" cy="65.6" r="1.3" fill="#fff"/><circle cx="57.8" cy="65.6" r="1.3" fill="#fff"/>
    <path d="M40 76 Q48 83 56 76" stroke="${OUTLINE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
}

/** 흡혈박쥐(추적병): 물결 모양 날개를 펼치고 비행기를 쫓아와 들이받는다 */
function vampireBat() {
  const wing = `<path d="M42 36 C30 20 14 14 3 18 C9 26 7 34 13 40 C19 36 23 42 25 48 C31 44 37 48 41 54 Z" fill="#4a2f5c" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M40 40 C32 32 22 26 12 24 M38 46 C32 42 26 40 20 40" stroke="#7a5690" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  return `
    ${wing}${mirror(96, wing)}
    <path d="M38 24 L33 8 L46 18 Z M58 24 L63 8 L50 18 Z" fill="#3b2449" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="48" cy="42" rx="14" ry="22" fill="#3b2449" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="48" cy="62" r="12" fill="#5c3a70" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="43" cy="60" r="3.2" fill="#ff4d4d"/><circle cx="53" cy="60" r="3.2" fill="#ff4d4d"/>
    <circle cx="42.4" cy="59.2" r="1" fill="#fff"/><circle cx="52.4" cy="59.2" r="1" fill="#fff"/>
    <ellipse cx="48" cy="66" rx="3" ry="2" fill="#2a1830"/>
    <path d="M43 69 L45.5 78 L48 69 Z M48 69 L50.5 78 L53 69 Z" fill="#ffffff" stroke="${OUTLINE}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

/** 카이만 보스: 등딱지 비늘을 두른 거대 비행선. 체력바를 모두 깎으면 격파된다 */
function caiman() {
  const scutes = [];
  for (const [y, xs] of [
    [70, [98, 128, 158]],
    [98, [84, 112, 144, 172]],
    [126, [98, 128, 158]],
  ]) {
    for (const x of xs) {
      scutes.push(`<rect x="${x - 11}" y="${y - 9}" width="22" height="18" rx="6" fill="#2f4f2f" stroke="#d4a72c" stroke-width="2"/>`);
    }
  }
  const teeth = [];
  for (let i = 0; i < 5; i += 1) {
    const y = 188 + i * 10;
    teeth.push(`<path d="M${96 + i} ${y} L${88 + i} ${y + 5} L${96 + i} ${y + 8} Z" fill="#fffbe6"/>`);
    teeth.push(`<path d="M${160 - i} ${y} L${168 - i} ${y + 5} L${160 - i} ${y + 8} Z" fill="#fffbe6"/>`);
  }
  return `
    <path d="M28 96 L4 150 L40 142 Z M228 96 L252 150 L216 142 Z" fill="#2f4f2f" stroke="${OUTLINE}" stroke-width="4" stroke-linejoin="round"/>
    <rect x="86" y="18" width="26" height="30" rx="6" fill="#2a2d3e" stroke="${OUTLINE}" stroke-width="4"/>
    <rect x="144" y="18" width="26" height="30" rx="6" fill="#2a2d3e" stroke="${OUTLINE}" stroke-width="4"/>
    <ellipse cx="128" cy="104" rx="104" ry="76" fill="#4c7a4a" stroke="${OUTLINE}" stroke-width="5"/>
    <ellipse cx="128" cy="104" rx="92" ry="64" fill="none" stroke="#d4a72c" stroke-width="4"/>
    ${scutes.join("")}
    <path d="M92 150 C94 196 100 236 128 244 C156 236 162 196 164 150 Z" fill="#5f9159" stroke="${OUTLINE}" stroke-width="5"/>
    ${teeth.join("")}
    <circle cx="116" cy="232" r="3.5" fill="${OUTLINE}"/>
    <circle cx="140" cy="232" r="3.5" fill="${OUTLINE}"/>
    <ellipse cx="104" cy="160" rx="13" ry="11" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="3"/>
    <ellipse cx="152" cy="160" rx="13" ry="11" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="3"/>
    <rect x="102" y="151" width="4" height="18" rx="2" fill="${OUTLINE}"/>
    <rect x="150" y="151" width="4" height="18" rx="2" fill="${OUTLINE}"/>
    <path d="M88 144 L118 152 M168 144 L138 152" stroke="${OUTLINE}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="40" cy="112" r="20" fill="#3b4252" stroke="${OUTLINE}" stroke-width="4"/>
    <circle cx="216" cy="112" r="20" fill="#3b4252" stroke="${OUTLINE}" stroke-width="4"/>
    <rect x="34" y="120" width="12" height="30" rx="3" fill="#2a2d3e" stroke="${OUTLINE}" stroke-width="3"/>
    <rect x="210" y="120" width="12" height="30" rx="3" fill="#2a2d3e" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="40" cy="108" r="7" fill="#d4a72c"/>
    <circle cx="216" cy="108" r="7" fill="#d4a72c"/>`;
}

// ---------- 카피바라들: 시작 화면 · 스테이지 배너 · 등급 (정면, 200×200 좌표) ----------

/** 정면 카피바라. eyes: calm 반쯤 감긴 눈 · happy 웃는 눈 · dizzy 빙글 · worried 걱정 */
function capybara({ eyes = "calm", back = "", front = "" }) {
  const eye = (x) => {
    switch (eyes) {
      case "happy":
        return `<path d="M${x - 8} 97 Q${x} 87 ${x + 8} 97" stroke="${OUTLINE}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
      case "dizzy":
        return `<path d="M${x} 95 m-2.5 0 a2.5 2.5 0 1 1 2.5 2.5 a5 5 0 1 1 -5 -5 a7.5 7.5 0 1 1 7.5 7.5" stroke="${OUTLINE}" stroke-width="2.5" fill="none"/>`;
      case "worried":
        return `<ellipse cx="${x}" cy="96" rx="5.5" ry="6.5" fill="${OUTLINE}"/><circle cx="${x - 1.5}" cy="93.5" r="2" fill="#fff"/>`;
      default:
        return `<ellipse cx="${x}" cy="97" rx="6" ry="5" fill="${OUTLINE}"/><path d="M${x - 9} 93 H${x + 9}" stroke="${C.furDark}" stroke-width="5" stroke-linecap="round"/><circle cx="${x + 2}" cy="98" r="1.6" fill="#fff"/>`;
    }
  };
  const brows =
    eyes === "worried"
      ? `<path d="M64 86 L86 78 M136 86 L114 78" stroke="${OUTLINE}" stroke-width="4" stroke-linecap="round"/>`
      : "";
  return `
    ${back}
    <ellipse cx="100" cy="194" rx="74" ry="44" fill="${C.fur}" stroke="${OUTLINE}" stroke-width="4"/>
    <circle cx="58" cy="54" r="13" fill="${C.furDark}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <circle cx="142" cy="54" r="13" fill="${C.furDark}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <circle cx="58" cy="55" r="6" fill="${C.earInner}"/><circle cx="142" cy="55" r="6" fill="${C.earInner}"/>
    <path d="M56 78 Q58 42 100 40 Q142 42 144 78 L150 138 Q150 176 100 178 Q50 176 50 138 Z" fill="${C.fur}" stroke="${OUTLINE}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M64 124 Q66 108 100 106 Q134 108 136 124 L138 146 Q136 170 100 171 Q64 170 62 146 Z" fill="${C.snout}"/>
    <rect x="78" y="116" width="44" height="18" rx="9" fill="#3b2415"/>
    <ellipse cx="90" cy="125" rx="3" ry="4" fill="#1a0f08"/><ellipse cx="110" cy="125" rx="3" ry="4" fill="#1a0f08"/>
    <path d="M92 146 Q100 152 108 146" stroke="#3b2415" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="62" cy="116" rx="9" ry="5" fill="#ff9aa2" opacity="0.55"/><ellipse cx="138" cy="116" rx="9" ry="5" fill="#ff9aa2" opacity="0.55"/>
    ${eye(78)}${eye(122)}${brows}
    ${front}`;
}

function capybaraArt(size, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">${body}</svg>`;
}

const yuzuTop = (cx, cy) =>
  `<circle cx="${cx}" cy="${cy}" r="14" fill="${C.yuzu}" stroke="${OUTLINE}" stroke-width="3"/><circle cx="${cx - 5}" cy="${cy - 5}" r="4" fill="#ffe08a"/><path d="M${cx} ${cy - 13} Q${cx + 10} ${cy - 25} ${cx + 21} ${cy - 19} Q${cx + 11} ${cy - 9} ${cx} ${cy - 13} Z" fill="${C.leaf}" stroke="${OUTLINE}" stroke-width="2"/>`;

const PILOT_CAP = `
  <path d="M54 72 Q56 30 100 28 Q144 30 146 72 Q100 60 54 72 Z" fill="#7a4a24" stroke="${OUTLINE}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M100 30 V62" stroke="#5a3418" stroke-width="3"/>
  <rect x="58" y="63" width="84" height="8" fill="${C.goggle}"/>
  <circle cx="80" cy="67" r="11" fill="${C.lens}" stroke="${C.goggle}" stroke-width="5"/>
  <circle cx="120" cy="67" r="11" fill="${C.lens}" stroke="${C.goggle}" stroke-width="5"/>
  <circle cx="76" cy="63" r="3" fill="#fff"/><circle cx="116" cy="63" r="3" fill="#fff"/>`;

const SCARF = `
  <path d="M136 186 L154 222 L130 220 Z" fill="#e5484d" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M46 172 Q100 194 154 172 L158 190 Q100 212 42 190 Z" fill="#e5484d" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>`;

const WAVE_PAW = `
  <ellipse cx="34" cy="126" rx="13" ry="26" transform="rotate(-25 34 126)" fill="${C.fur}" stroke="${OUTLINE}" stroke-width="4"/>
  <path d="M14 94 q-6 -4 -8 -10 M24 88 q-2 -6 0 -12 M6 108 q-6 -2 -9 -7" stroke="${OUTLINE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;

const SALUTE_PAW = `
  <ellipse cx="152" cy="82" rx="13" ry="24" transform="rotate(40 152 82)" fill="${C.fur}" stroke="${OUTLINE}" stroke-width="4"/>
  <path d="M162 64 l6 -4 M166 71 l7 -3 M168 78 l7 -1" stroke="${OUTLINE}" stroke-width="2.5" stroke-linecap="round"/>`;

const HELMET = `
  <path d="M46 88 Q46 24 100 22 Q154 24 154 88 L140 88 Q138 52 100 50 Q62 52 60 88 Z" fill="#8a93a6" stroke="${OUTLINE}" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="68" cy="46" r="3.5" fill="#5d6068"/><circle cx="100" cy="34" r="3.5" fill="#5d6068"/><circle cx="132" cy="46" r="3.5" fill="#5d6068"/>
  <path d="M100 22 V10" stroke="${OUTLINE}" stroke-width="3"/><circle cx="100" cy="8" r="6" fill="#e5484d" stroke="${OUTLINE}" stroke-width="2"/>
  <path d="M154 100 Q163 115 154 122 Q145 115 154 100 Z" fill="#8fd3ff" stroke="${OUTLINE}" stroke-width="2.5"/>`;

const CROWN = `
  <path d="M62 52 L70 18 L86 38 L100 10 L114 38 L130 18 L138 52 Z" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="100" cy="38" r="5.5" fill="#e5484d"/><circle cx="78" cy="44" r="4" fill="#4f7cff"/><circle cx="122" cy="44" r="4" fill="#4f7cff"/>`;

const CAPE = `
  <path d="M20 204 Q26 146 70 158 L130 158 Q174 146 180 204 Z" fill="#8e1b3a" stroke="${OUTLINE}" stroke-width="4"/>
  <path d="M24 40 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 z M168 30 l2.5 -6 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 z M178 118 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 z" fill="#ffd23f"/>`;

const SUNGLASSES = `
  <path d="M54 92 H146" stroke="${OUTLINE}" stroke-width="5"/>
  <rect x="58" y="84" width="36" height="24" rx="10" fill="#1f2433" stroke="${OUTLINE}" stroke-width="3"/>
  <rect x="106" y="84" width="36" height="24" rx="10" fill="#1f2433" stroke="${OUTLINE}" stroke-width="3"/>
  <path d="M65 91 H77 M113 91 H125" stroke="#8fd3ff" stroke-width="3" stroke-linecap="round"/>`;

const MEDAL = `
  <path d="M120 164 L132 184 L144 164" fill="none" stroke="#4f7cff" stroke-width="8"/>
  <circle cx="132" cy="186" r="11" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="3"/>
  <path d="M132 179 l2.2 4.5 l5 0.7 l-3.6 3.5 l0.9 5 l-4.5 -2.4 l-4.5 2.4 l0.9 -5 l-3.6 -3.5 l5 -0.7 z" fill="#e0a800"/>`;

const BANDAGE = `
  <rect x="110" y="44" width="36" height="11" rx="3" fill="#ffffff" stroke="${OUTLINE}" stroke-width="2.5" transform="rotate(30 128 49)"/>
  <rect x="110" y="44" width="36" height="11" rx="3" fill="#ffffff" stroke="${OUTLINE}" stroke-width="2.5" transform="rotate(-30 128 49)"/>
  <rect x="50" y="120" width="22" height="10" rx="5" fill="#ffd6a5" stroke="${OUTLINE}" stroke-width="2" transform="rotate(-20 61 125)"/>
  <path d="M80 44 Q88 20 110 22 Q102 46 80 44 Z" fill="${C.leaf}" stroke="${OUTLINE}" stroke-width="3"/>
  <path d="M84 42 Q96 32 106 26" stroke="${C.leafDark}" stroke-width="2" fill="none"/>`;

/** 위에서 본 카피바라 (배경용). 머리가 angle 방향을 향한다. submerged면 머리만 물 위에 나와 있다 */
function topCapybara(x, y, angle, scale = 1, { yuzu = false, submerged = false } = {}) {
  return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">
    ${submerged ? "" : `<ellipse cx="0" cy="12" rx="24" ry="34" fill="${C.fur}" stroke="${OUTLINE}" stroke-width="3"/>`}
    <ellipse cx="0" cy="-24" rx="17" ry="20" fill="${C.fur}" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="-13" cy="-11" r="5" fill="${C.furDark}" stroke="${OUTLINE}" stroke-width="1.5"/><circle cx="13" cy="-11" r="5" fill="${C.furDark}" stroke="${OUTLINE}" stroke-width="1.5"/>
    <rect x="-9" y="-44" width="18" height="8" rx="4" fill="#3b2415"/>
    <path d="M-9 -27 h5 M4 -27 h5" stroke="${OUTLINE}" stroke-width="2.5" stroke-linecap="round"/>
    ${yuzu ? `<circle cx="0" cy="-16" r="7" fill="${C.yuzu}" stroke="${OUTLINE}" stroke-width="2"/>` : ""}
  </g>`;
}

/** 강물을 거슬러 헤엄치는 카피바라 (물결 포함) */
function swimmer(wrapped, y, dx, scale, options = {}) {
  const x = riverX(y) + dx;
  const slope = (riverX(y + 1) - riverX(y - 1)) / 2;
  const angle = (Math.atan2(-slope, 1) * 180) / Math.PI;
  wrapped(y, 60 * scale, (cy) =>
    `<ellipse cx="${x}" cy="${cy}" rx="${34 * scale}" ry="${52 * scale}" transform="rotate(${angle} ${x} ${cy})" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.35"/>` +
    topCapybara(x, cy, angle, scale, options),
  );
}

// ---------- 아이템: 카피바라 간식 (그 간식이 곧 바뀌는 무기의 탄) ----------

function itemFrame(icon) {
  return svg(
    80,
    80,
    `<circle cx="40" cy="40" r="34" fill="#2b1d12" stroke="#ffd23f" stroke-width="4"/>
     <path d="M16 30 A26 26 0 0 1 40 12" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.35" stroke-linecap="round"/>
     ${icon}`,
  );
}

const seed = (cx, cy, angle) =>
  `<g transform="rotate(${angle} ${cx} ${cy})"><path d="${pointed(cx, cy, 13, 38)}" fill="#2b2b2b" stroke="#f4efe3" stroke-width="2"/><path d="M${cx - 2.5} ${cy - 11} L${cx - 2.5} ${cy + 11} M${cx + 2.5} ${cy - 11} L${cx + 2.5} ${cy + 11}" stroke="#f4efe3" stroke-width="1.6"/></g>`;

const ITEM_ICONS = {
  double: `${seed(31, 42, -12)}${seed(49, 42, 12)}`,
  spread: `<path d="M40 25 Q46 17 54 19 Q49 27 40 25 Z" fill="${C.leaf}" stroke="${OUTLINE}" stroke-width="1.5"/>
    <circle cx="40" cy="44" r="18" fill="${C.orange}" stroke="${OUTLINE}" stroke-width="2.5"/>
    <path d="M40 30 V58 M27 38 L53 50 M27 50 L53 38" stroke="#ffc766" stroke-width="2"/>
    <circle cx="34" cy="37" r="3.5" fill="#ffe3b0"/>`,
  rapid: `<path d="M28 56 Q30 40 40 60 Q50 40 52 56 Q44 70 40 68 Q36 70 28 56 Z" fill="${C.leafDark}" stroke="${OUTLINE}" stroke-width="2"/>
    <ellipse cx="40" cy="38" rx="11" ry="22" fill="${C.corn}" stroke="${OUTLINE}" stroke-width="2.5"/>
    ${[26, 33, 40, 47].map((y) => `<path d="M31 ${y} H49" stroke="#d99a00" stroke-width="1.6"/>`).join("")}
    <path d="M36 18 V58 M44 18 V58" stroke="#d99a00" stroke-width="1.6"/>`,
  pierce: `<path d="M44 44 Q60 34 64 20 Q52 28 44 38 Z" fill="${C.leaf}" stroke="${OUTLINE}" stroke-width="1.5"/>
    <path d="M35 66 V18 L40 10 L45 18 V66 Z" fill="${C.cane}" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M35 30 H45 M35 44 H45 M35 58 H45" stroke="${C.leafDark}" stroke-width="3"/>`,
  // 유자를 머리에 얹고 온천에 몸을 담근 카피바라
  heal: `<path d="M20 22 Q16 26 20 30 Q24 34 20 38 M60 22 Q56 26 60 30 Q64 34 60 38" stroke="#ffffff" stroke-width="2.5" fill="none" opacity="0.85" stroke-linecap="round"/>
    <circle cx="31" cy="29" r="3.5" fill="${C.furDark}" stroke="${OUTLINE}" stroke-width="1.2"/>
    <circle cx="49" cy="29" r="3.5" fill="${C.furDark}" stroke="${OUTLINE}" stroke-width="1.2"/>
    <path d="M28 48 V36 Q28 26 40 26 Q52 26 52 36 V48 Z" fill="${C.fur}" stroke="${OUTLINE}" stroke-width="2"/>
    <rect x="31" y="37" width="18" height="7" rx="3.5" fill="#3b2415"/>
    <path d="M33 33 q2.5 -2 5 0 M42 33 q2.5 -2 5 0" stroke="${OUTLINE}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <circle cx="40" cy="21" r="5" fill="${C.yuzu}" stroke="${OUTLINE}" stroke-width="1.3"/>
    <path d="M17 47 H63 L57 66 H23 Z" fill="#a8703d" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M20 57 H60" stroke="#6e4524" stroke-width="2.5"/>
    <ellipse cx="40" cy="47" rx="23" ry="5" fill="#6fd3ff" stroke="${OUTLINE}" stroke-width="2"/>`,
};

// ---------- 탄 ----------

function glow(deviation) {
  return `<filter id="glow" x="-60%" y="-30%" width="220%" height="160%"><feGaussianBlur stdDeviation="${deviation}"/></filter>`;
}

const BULLETS = {
  // 풀잎탄: 가운데 잎맥이 있는 초록 잎
  basic: svg(
    12,
    48,
    `<path d="${pointed(6, 24, 11, 46)}" fill="${C.leaf}" stroke="${C.leafDark}" stroke-width="1.5"/><path d="M6 6 V42" stroke="#eaffd9" stroke-width="1.6"/>`,
  ),
  // 해바라기씨: 검은 씨에 흰 줄무늬
  double: svg(
    12,
    48,
    `<path d="${pointed(6, 24, 11, 46)}" fill="#2b2b2b" stroke="#f4efe3" stroke-width="1.5"/><path d="M4 10 V38 M8 10 V38" stroke="#f4efe3" stroke-width="1.3"/>`,
  ),
  // 옥수수 알: 가늘고 긴 노란 알갱이, 끝이 하얗다
  rapid: svg(
    8,
    40,
    `<rect x="1" y="1" width="6" height="38" rx="3" fill="${C.corn}" stroke="#d99a00" stroke-width="1"/><rect x="2.5" y="3" width="3" height="8" rx="1.5" fill="#fffbe6"/><path d="M1.5 20 H6.5 M1.5 28 H6.5" stroke="#d99a00" stroke-width="1"/>`,
  ),
  // 귤 알갱이: 작고 동그란 귤, 초록 꼭지
  spread: svg(
    24,
    24,
    `<circle cx="12" cy="13" r="9.5" fill="${C.orange}" stroke="#c96a00" stroke-width="1.5"/><circle cx="9" cy="10" r="3" fill="#ffe3b0"/><ellipse cx="15" cy="4" rx="3.5" ry="2" fill="${C.leaf}" transform="rotate(-25 15 4)"/>`,
  ),
  // 사탕수수: 마디가 있는 연두색 줄기에 은은한 빛
  pierce: svg(
    20,
    64,
    `<rect x="3" y="4" width="14" height="58" rx="7" fill="${C.cane}" opacity="0.55" filter="url(#glow)"/>
     <path d="M6 62 V10 L10 2 L14 10 V62 Z" fill="${C.cane}" stroke="${C.leafDark}" stroke-width="1.5" stroke-linejoin="round"/>
     <path d="M6 22 H14 M6 36 H14 M6 50 H14" stroke="${C.leafDark}" stroke-width="2.2"/>`,
    glow(2.5),
  ),
  // 재규어의 가시 열매: 가시가 돋은 검붉은 열매
  "enemy-shot": (() => {
    const points = Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2;
      const r = i % 2 === 0 ? 15 : 9;
      return `${16 + Math.cos(angle) * r},${16 + Math.sin(angle) * r}`;
    }).join(" ");
    return svg(
      32,
      32,
      `<polygon points="${points}" fill="#c0392b" stroke="#5a0f0a" stroke-width="1.5" stroke-linejoin="round"/><circle cx="16" cy="16" r="6" fill="#7a1a14"/><circle cx="14" cy="14" r="2.5" fill="#ff9a8a"/>`,
    );
  })(),
  // 카이만의 늪 독방울: 매끈한 보라 방울과 반사광
  "boss-shot": svg(
    32,
    32,
    `<circle cx="16" cy="16" r="12" fill="#b84dff" stroke="#f3d0ff" stroke-width="2.5"/><circle cx="16" cy="16" r="6" fill="#7a1fc2" opacity="0.7"/><path d="M9 12 A8 8 0 0 1 15 7" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  ),
};

// ---------- 격추 효과: 펑 연기 + 흩날리는 깃털과 잎 (4프레임) ----------

function poof(frame) {
  const random = seeded(100 + frame);
  const parts = [];
  const soft = `<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${frame === 4 ? 3 : 1.2}"/></filter>`;

  const rays = (count, inner, outer) => {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + random() * 0.3;
      parts.push(
        `<line x1="${64 + Math.cos(angle) * inner}" y1="${64 + Math.sin(angle) * inner}" x2="${64 + Math.cos(angle) * outer}" y2="${64 + Math.sin(angle) * outer}" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/>`,
      );
    }
  };
  const puffs = (count, spread, radius, color, opacity) => {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const distance = random() * spread;
      parts.push(
        `<circle cx="${64 + Math.cos(angle) * distance}" cy="${64 + Math.sin(angle) * distance}" r="${radius * (0.6 + random() * 0.6)}" fill="${color}" opacity="${opacity}"/>`,
      );
    }
  };
  const flutter = (count, from, to, opacity) => {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + random() * 0.5;
      const distance = from + random() * (to - from);
      const x = 64 + Math.cos(angle) * distance;
      const y = 64 + Math.sin(angle) * distance;
      const color = i % 2 === 0 ? C.leaf : "#9a9fab";
      parts.push(
        `<ellipse cx="${x}" cy="${y}" rx="7" ry="3" transform="rotate(${(angle * 180) / Math.PI + random() * 60} ${x} ${y})" fill="${color}" stroke="${OUTLINE}" stroke-width="1" opacity="${opacity}"/>`,
      );
    }
  };

  if (frame === 1) {
    rays(8, 18, 34);
    parts.push(`<circle cx="64" cy="64" r="20" fill="#fff6d8" filter="url(#soft)"/><circle cx="64" cy="64" r="12" fill="#ffffff"/>`);
  } else if (frame === 2) {
    puffs(8, 20, 20, "#fff4d6", 1);
    puffs(4, 10, 14, "#ffffff", 1);
    flutter(6, 32, 44, 1);
  } else if (frame === 3) {
    puffs(9, 30, 22, "#ebe4d2", 0.9);
    puffs(5, 18, 15, "#ffffff", 0.9);
    flutter(8, 44, 56, 0.95);
  } else {
    parts.push(`<g filter="url(#soft)">`);
    puffs(8, 38, 18, "#d8d2c4", 0.45);
    parts.push(`</g>`);
    flutter(6, 52, 60, 0.55);
  }
  return svg(128, 128, parts.join(""), soft);
}

// ---------- 배경: 위에서 내려다본 카피바라 습지 (위아래가 이어지는 1080×1920 타일) ----------

const BG_WIDTH = 1080;
const BG_HEIGHT = 1920;
/**
 * 흐림 필터는 이미지 가장자리 밖을 투명으로 보고 번져서 타일 경계에 어두운 줄이 생긴다.
 * 위아래로 이만큼 더 크게 그린 뒤 가운데 BG_HEIGHT만 잘라내 경계에서도 실제 내용을 보고 번지게 한다
 */
const BG_PAD = 120;

/** 강 중심선. 주기가 BG_HEIGHT라 타일 위아래가 정확히 이어진다 */
const riverX = (y) =>
  BG_WIDTH / 2 + 250 * Math.sin((2 * Math.PI * y) / BG_HEIGHT) + 70 * Math.sin((4 * Math.PI * y) / BG_HEIGHT + 1.3);

function wetland({ seed: seedValue, land, landDark, bank, water, waterLight, lilyPad, lilyFlower, bushes, pads, extra }) {
  const random = seeded(seedValue);
  const parts = [];

  /** 타일 경계(여유 영역 포함)에 걸친 요소는 반대편에도 그려 스크롤할 때 이음새가 안 보이게 한다 */
  const wrapped = (y, reach, render) => {
    const margin = reach + BG_PAD;
    parts.push(render(y));
    if (y < margin) parts.push(render(y + BG_HEIGHT));
    if (y > BG_HEIGHT - margin) parts.push(render(y - BG_HEIGHT));
  };

  parts.push(`<rect y="${-BG_PAD}" width="${BG_WIDTH}" height="${BG_HEIGHT + BG_PAD * 2}" fill="${land}"/>`);

  // 땅의 얼룩 (넓고 옅은 풀밭 무늬)
  for (let i = 0; i < 18; i += 1) {
    const x = random() * BG_WIDTH;
    const rx = 120 + random() * 160;
    const ry = 60 + random() * 90;
    wrapped(random() * BG_HEIGHT, ry, (y) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${landDark}" opacity="0.35"/>`);
  }

  // 강: 둑 → 물 → 물빛 순서로 겹쳐 그린다
  const points = [];
  for (let y = -BG_PAD - 40; y <= BG_HEIGHT + BG_PAD + 40; y += 16) points.push(`${riverX(y).toFixed(1)},${y}`);
  const river = points.join(" ");
  parts.push(`<polyline points="${river}" fill="none" stroke="${bank}" stroke-width="310" stroke-linejoin="round"/>`);
  parts.push(`<polyline points="${river}" fill="none" stroke="${water}" stroke-width="250" stroke-linejoin="round"/>`);
  parts.push(`<polyline points="${river}" fill="none" stroke="${waterLight}" stroke-width="120" stroke-linejoin="round" opacity="0.45"/>`);

  // 수풀 (강 위에는 두지 않는다)
  for (let placed = 0; placed < bushes; ) {
    const x = random() * BG_WIDTH;
    const y = random() * BG_HEIGHT;
    if (Math.abs(x - riverX(y)) < 190) continue;
    placed += 1;
    const blobs = Array.from({ length: 4 }, () => [random() * 50 - 25, random() * 30 - 15, 16 + random() * 18]);
    wrapped(y, 45, (cy) =>
      blobs
        .map(
          ([dx, dy, r]) =>
            `<circle cx="${x + dx}" cy="${cy + dy}" r="${r}" fill="${landDark}"/><circle cx="${x + dx - r * 0.3}" cy="${cy + dy - r * 0.3}" r="${r * 0.45}" fill="${land}" opacity="0.5"/>`,
        )
        .join(""),
    );
  }

  // 연잎 (강 위에만)
  for (let i = 0; i < pads; i += 1) {
    const y = random() * BG_HEIGHT;
    const x = riverX(y) + (random() - 0.5) * 170;
    const r = 14 + random() * 14;
    const notch = random() * 360;
    const flower = random() < 0.3;
    wrapped(y, r, (cy) =>
      `<g transform="rotate(${notch} ${x} ${cy})"><circle cx="${x}" cy="${cy}" r="${r}" fill="${lilyPad}"/><path d="M${x} ${cy} L${x + r + 1} ${cy - r * 0.4} L${x + r + 1} ${cy + r * 0.4} Z" fill="${water}"/></g>` +
      (flower ? `<circle cx="${x - r * 0.2}" cy="${cy - r * 0.2}" r="${r * 0.35}" fill="${lilyFlower}"/>` : ""),
    );
  }

  parts.push(extra({ random, wrapped }));

  const defs = `<filter id="blur" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="14"/></filter>`;
  // extra()가 wrapped로 추가한 요소까지 포함하려고 마지막에 합친다
  const fullHeight = BG_HEIGHT + BG_PAD * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BG_WIDTH}" height="${fullHeight}" viewBox="0 ${-BG_PAD} ${BG_WIDTH} ${fullHeight}"><defs>${defs}</defs>${parts.join("")}</svg>`;
}

const BACKGROUNDS = {
  // 아침 늪: 초록 풀밭, 파란 강, 강가의 돌
  "swamp-morning": wetland({
    seed: 11,
    land: "#2e5530",
    landDark: "#21402a",
    bank: "#6b5a3a",
    water: "#2c6a86",
    waterLight: "#4f93b0",
    lilyPad: "#5fae4f",
    lilyFlower: "#ffc2e0",
    bushes: 26,
    pads: 34,
    extra: ({ random, wrapped }) => {
      for (let i = 0; i < 14; i += 1) {
        const y = random() * BG_HEIGHT;
        const side = random() < 0.5 ? -1 : 1;
        const x = riverX(y) + side * (140 + random() * 16);
        const r = 7 + random() * 8;
        wrapped(y, r, (cy) => `<ellipse cx="${x}" cy="${cy}" rx="${r * 1.3}" ry="${r}" fill="#8c8f96" stroke="#5d6068" stroke-width="2"/>`);
      }
      // 강을 거슬러 헤엄치는 카피바라들과, 강둑에서 쉬는 카피바라들
      swimmer(wrapped, 280, -30, 0.9);
      swimmer(wrapped, 940, 35, 0.95, { yuzu: true });
      swimmer(wrapped, 1540, 0, 0.9);
      swimmer(wrapped, 1620, 12, 0.5);
      for (const [y, side, angle] of [
        [620, -1, 70],
        [1260, 1, -110],
      ]) {
        const x = riverX(y) + side * 200;
        wrapped(y, 60, (cy) => topCapybara(x, cy, angle, 0.9));
      }
      return "";
    },
  }),
  // 노을 강: 보랏빛 땅, 노을이 비친 강물 줄무늬
  "river-sunset": wetland({
    seed: 22,
    land: "#3d2c3e",
    landDark: "#2b1f31",
    bank: "#7a4b3a",
    water: "#6b3d63",
    waterLight: "#d9784f",
    lilyPad: "#6f8a4a",
    lilyFlower: "#ffb3c7",
    bushes: 24,
    pads: 26,
    extra: ({ random, wrapped }) => {
      for (let i = 0; i < 40; i += 1) {
        const y = random() * BG_HEIGHT;
        const x = riverX(y) + (random() - 0.5) * 160;
        const width = 24 + random() * 40;
        wrapped(y, 3, (cy) => `<rect x="${x - width / 2}" y="${cy - 2}" width="${width}" height="4" rx="2" fill="#f2a65a" opacity="0.55"/>`);
      }
      // 엄마 카피바라를 따라 줄지어 헤엄치는 아기 카피바라들
      swimmer(wrapped, 700, 0, 1);
      swimmer(wrapped, 795, -16, 0.5);
      swimmer(wrapped, 855, 14, 0.5);
      swimmer(wrapped, 915, -8, 0.5);
      swimmer(wrapped, 1560, 34, 0.9, { yuzu: true });
      {
        const y = 1180;
        const x = riverX(y) - 205;
        wrapped(y, 60, (cy) => topCapybara(x, cy, 95, 0.95));
      }
      return "";
    },
  }),
  // 밤 온천: 짙은 남색 땅, 김이 오르는 온천물과 반딧불이
  "onsen-night": wetland({
    seed: 33,
    land: "#16213a",
    landDark: "#0e172b",
    bank: "#3a3f52",
    water: "#23606b",
    waterLight: "#4fb3b8",
    lilyPad: "#2f5a45",
    lilyFlower: "#fff3b0",
    bushes: 22,
    pads: 18,
    extra: ({ random, wrapped }) => {
      for (let i = 0; i < 16; i += 1) {
        const y = random() * BG_HEIGHT;
        const x = riverX(y) + (random() - 0.5) * 120;
        wrapped(y, 70, (cy) => `<ellipse cx="${x}" cy="${cy}" rx="${60 + random() * 30}" ry="28" fill="#ffffff" opacity="0.16" filter="url(#blur)"/>`);
      }
      for (let i = 0; i < 70; i += 1) {
        const y = random() * BG_HEIGHT;
        const x = random() * BG_WIDTH;
        wrapped(y, 6, (cy) => `<circle cx="${x}" cy="${cy}" r="${1.6 + random() * 1.6}" fill="#fff07a" opacity="${0.5 + random() * 0.5}"/>`);
      }
      // 온천에 몸을 담그고 머리에 유자를 얹은 카피바라들
      for (const [y, dx] of [
        [220, -40],
        [560, 45],
        [990, -30],
        [1380, 40],
        [1760, -20],
      ]) {
        const x = riverX(y) + dx;
        wrapped(y, 50, (cy) =>
          `<circle cx="${x}" cy="${cy - 24}" r="30" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.3"/>` +
          topCapybara(x, cy, 0, 1, { yuzu: true, submerged: true }),
        );
      }
      return "";
    },
  }),
};

// ---------- 빌드 ----------

const ASSETS = [
  ["plane/plane", plane(0)],
  ["plane/plane-bank-left", plane(-1)],
  ["plane/plane-bank-right", plane(1)],
  ["plane/plane-hurt", plane(0, true)],
  ["plane/flame-1", flame(60, false)],
  ["plane/flame-2", flame(44, true)],
  ["enemy/straight", svg(96, 96, harpyEagle())],
  ["enemy/straight-hit", withHit(96, 96, harpyEagle())],
  ["enemy/zigzag", svg(96, 96, wasp())],
  ["enemy/zigzag-hit", withHit(96, 96, wasp())],
  ["enemy/shooter", svg(112, 112, jaguar())],
  ["enemy/shooter-hit", withHit(112, 112, jaguar())],
  ["enemy/shield", svg(96, 96, armadillo())],
  ["enemy/shield-hit", withHit(96, 96, armadillo())],
  ["enemy/dasher", svg(96, 96, swift())],
  ["enemy/dasher-hit", withHit(96, 96, swift())],
  ["enemy/splitter", svg(96, 96, dartFrog())],
  ["enemy/splitter-hit", withHit(96, 96, dartFrog())],
  ["enemy/homing", svg(96, 96, vampireBat())],
  ["enemy/homing-hit", withHit(96, 96, vampireBat())],
  ["enemy/boss", svg(256, 256, caiman())],
  ["enemy/boss-hit", withHit(256, 256, caiman())],
  ...Object.entries(ITEM_ICONS).map(([name, icon]) => [`item/${name}`, itemFrame(icon)]),
  ...Object.entries(BULLETS).map(([name, source]) => [`bullet/${name}`, source]),
  ...[1, 2, 3, 4].map((frame) => [`effect/explosion-${frame}`, poof(frame)]),
  ...Object.entries(BACKGROUNDS).map(([name, source]) => [`background/${name}`, source]),
  ["capybara/hero", capybaraArt(288, capybara({ eyes: "happy", front: PILOT_CAP + yuzuTop(100, 24) + SCARF + WAVE_PAW }))],
  ["capybara/banner-stage", capybaraArt(192, capybara({ eyes: "calm", front: PILOT_CAP + SALUTE_PAW }))],
  ["capybara/banner-boss", capybaraArt(192, capybara({ eyes: "worried", front: HELMET }))],
  ["capybara/tier-legend", capybaraArt(240, capybara({ eyes: "happy", back: CAPE, front: CROWN }))],
  ["capybara/tier-ace", capybaraArt(240, capybara({ eyes: "calm", front: SUNGLASSES + SCARF }))],
  ["capybara/tier-veteran", capybaraArt(240, capybara({ eyes: "calm", front: PILOT_CAP + MEDAL }))],
  ["capybara/tier-pilot", capybaraArt(240, capybara({ eyes: "happy", front: PILOT_CAP + yuzuTop(100, 24) }))],
  ["capybara/tier-trainee", capybaraArt(240, capybara({ eyes: "dizzy", front: BANDAGE }))],
];

// 같은 그림이 두 파일로 나가면 "에셋 하나에 용도 하나" 규칙이 깨지므로 빌드를 멈춘다
const seen = new Map();
for (const [name, source] of ASSETS) {
  const hash = createHash("sha1").update(source).digest("hex");
  if (seen.has(hash)) throw new Error(`${name} 그림이 ${seen.get(hash)}와 똑같아요`);
  seen.set(hash, name);
}

for (const [name, source] of ASSETS) {
  const svgPath = path.join(SRC_DIR, `${name}.svg`);
  const webpPath = path.join(OUT_DIR, `${name}.webp`);
  await mkdir(path.dirname(svgPath), { recursive: true });
  await mkdir(path.dirname(webpPath), { recursive: true });
  await writeFile(svgPath, source);
  const image = sharp(Buffer.from(source));
  if (name.startsWith("background/")) {
    // 여유 영역을 잘라내 위아래가 정확히 이어지는 타일 한 장만 남긴다
    await image.extract({ left: 0, top: BG_PAD, width: BG_WIDTH, height: BG_HEIGHT }).webp({ quality: 84 }).toFile(webpPath);
  } else {
    await image.webp({ quality: 92, alphaQuality: 100 }).toFile(webpPath);
  }
}

console.log(`${ASSETS.length}개 스프라이트 생성 완료 → ${path.relative(ROOT, OUT_DIR)}`);
