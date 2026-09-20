// 3D 카피바라를 프레임마다 찍어 스프라이트로 굽는다 (헤드리스 크로미움 + three.js).
//   node assets-src/characters/capybara-3d/bake.mjs                → 몸 프레임 + 옷마다 시트 + lib/lobby/capybara-3d.ts
//   node assets-src/characters/capybara-3d/bake.mjs preview [out.png] [프레임,…] [--item 칸/id,…]
//                                                                  → 확인용 합성 시트 (몸 위에 옷을 로비와 같은 방식으로 겹침)
//   node assets-src/characters/capybara-3d/bake.mjs body 프레임,…  → 그 몸 프레임만 다시 굽는다 (원래 그림과 나란히 비교할 때)
// 옷은 몸과 같은 뼈에 붙어 있어서(items.js) 어떤 자세에서도 몸을 따라가고, 몸 뒤로 돌아간 부분은 몸을 가림막으로 찍어 지운다.
// 그래서 로비는 몸 그림 위에 같은 칸의 옷 그림을 그대로 겹치기만 하면 된다
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const THREE_DIR = path.join(ROOT, "node_modules/three");
const OUT = path.join(ROOT, "public/assets/images/characters/capybara-3d");
const MANIFEST = path.join(ROOT, "lib/lobby/capybara-3d.ts");

/** 몸 프레임 크기 (로비 스프라이트와 같은 384) */
const BODY_SIZE = 384;
/** 옷 시트 한 칸 크기. 로비는 76px × 기기 배율로 그린다 — 192면 배율 2까지 1:1, 3에서도 봉제인형이라 티가 안 난다 (모바일 용량: 한벌옷 시트 ≈ 300KB) */
const CELL = 192;
/** 2배로 찍어 줄여서 가장자리를 매끄럽게 */
const SUPER = 2;

const MIME = { ".js": "text/javascript", ".html": "text/html" };
const PAGE = `<!doctype html><html><body style="margin:0;background:transparent">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module" src="/stage.js"></script></body></html>`;

async function openStage() {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.error("page:", error.message));
  page.on("console", (message) => message.type() === "error" && console.error("console:", message.text()));
  await page.route("http://bake.local/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/") return route.fulfill({ body: PAGE, contentType: "text/html" });
    const file = url.pathname.startsWith("/three/") ? path.join(THREE_DIR, url.pathname.slice(7)) : path.join(HERE, url.pathname);
    try {
      return route.fulfill({ body: await readFile(file), contentType: MIME[path.extname(file)] ?? "application/octet-stream" });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
  await page.goto("http://bake.local/");
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60_000 });
  const info = await page.evaluate(async () => {
    const { FRAMES } = await import("/frames.js");
    const { ITEMS } = await import("/items.js");
    return { frames: Object.keys(FRAMES), items: Object.keys(ITEMS) };
  });
  return { browser, page, ...info };
}

/** 한 장 찍어 size로 줄인 RGBA PNG 버퍼 */
async function shoot(page, frame, layer, size) {
  const url = await page.evaluate((args) => window.shoot(args), { frame, layer, size: size * SUPER });
  const png = Buffer.from(url.split(",")[1], "base64");
  return sharp(png).resize(size, size, { kernel: "lanczos3" }).png().toBuffer();
}

async function bake({ page, frames, items }) {
  await mkdir(OUT, { recursive: true });
  const cols = Math.ceil(Math.sqrt(frames.length));
  const rows = Math.ceil(frames.length / cols);
  const anchors = {};
  for (const frame of frames) {
    const png = await shoot(page, frame, "body", BODY_SIZE);
    await sharp(png).webp({ quality: 88, alphaQuality: 95, effort: 6 }).toFile(path.join(OUT, `capybara-${frame}.webp`));
    anchors[frame] = await page.evaluate((f) => window.anchors(f), frame);
  }
  console.log(`몸 ${frames.length}장`);
  for (const item of items) {
    const cells = [];
    for (const [index, frame] of frames.entries()) {
      cells.push({ input: await shoot(page, frame, item, CELL), left: (index % cols) * CELL, top: Math.floor(index / cols) * CELL });
    }
    const [slot, id] = item.split("/");
    await mkdir(path.join(OUT, "wardrobe", slot), { recursive: true });
    await sharp({ create: { width: cols * CELL, height: rows * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(cells)
      .webp({ quality: 82, alphaQuality: 90, effort: 6 })
      .toFile(path.join(OUT, "wardrobe", slot, `${id}.webp`));
    // 옷장 칸 그림: 옷 입은 정면 대각선 모습 (몸 + 옷)
    const icon = await sharp(await shoot(page, "stand-down-right", "body", 256))
      .composite([{ input: await shoot(page, "stand-down-right", item, 256) }])
      .png()
      .toBuffer();
    await sharp(icon).trim({ threshold: 1 }).webp({ quality: 90 }).toFile(path.join(OUT, "wardrobe", slot, `${id}-icon.webp`));
    console.log(`옷 ${item}`);
  }
  const ts = `// 생성 파일 — 고치지 말고 \`node assets-src/characters/capybara-3d/bake.mjs\` 로 다시 굽는다
// 3D 카피바라(assets-src/characters/capybara-3d)를 구운 프레임 목록과 옷 시트 칸 배치, 프레임마다 머리 기준점(이미지 %)
export const BAKED_FRAMES = ${JSON.stringify(frames)} as const;
export type BakedFrame = (typeof BAKED_FRAMES)[number];
/** 옷 시트: 프레임 순서대로 가로 cols칸, 한 칸 cell px */
export const OUTFIT_SHEET = { cols: ${cols}, rows: ${rows}, cell: ${CELL} } as const;
/** 구운 옷 (칸/id) */
export const BAKED_ITEMS: readonly string[] = ${JSON.stringify(items)};
/** 머리 꼭대기·가운데 [x, y] (이미지 %) */
export const HEAD_ANCHORS: Record<BakedFrame, { headTop: readonly [number, number]; headCenter: readonly [number, number] }> = ${JSON.stringify(anchors)};
`;
  await writeFile(MANIFEST, ts);
  console.log(`→ ${path.relative(ROOT, MANIFEST)}`);
}

/** 확인용: 프레임마다 몸 + (옷들) 을 로비처럼 겹친 시트 */
async function preview({ page, frames, items }, out, only, wear) {
  const list = only?.length ? only : frames;
  const size = 256;
  const cols = Math.min(list.length, 8);
  const tiles = [];
  for (const [index, frame] of list.entries()) {
    const layers = [{ input: await shoot(page, frame, "body", size) }];
    for (const item of wear) layers.push({ input: await shoot(page, frame, item, size) });
    const tile = await sharp({ create: { width: size, height: size, channels: 4, background: "#3d6a3a" } }).composite(layers).png().toBuffer();
    tiles.push({ input: tile, left: (index % cols) * size, top: Math.floor(index / cols) * size });
  }
  await sharp({ create: { width: cols * size, height: Math.ceil(list.length / cols) * size, channels: 4, background: "#3d6a3a" } })
    .composite(tiles)
    .jpeg({ quality: 88 })
    .toFile(out);
  console.log(`→ ${out}  (옷: ${wear.join(", ") || "없음"}, 전체 옷: ${items.join(", ") || "없음"})`);
}

const [mode, ...rest] = process.argv.slice(2);
const stage = await openStage();
try {
  if (mode === "body") {
    for (const frame of rest[0].split(",")) {
      await sharp(await shoot(stage.page, frame, "body", BODY_SIZE)).webp({ quality: 88, alphaQuality: 95, effort: 6 }).toFile(path.join(OUT, `capybara-${frame}.webp`));
    }
  } else if (mode === "preview") {
    const itemAt = rest.indexOf("--item");
    const wear = itemAt >= 0 ? rest[itemAt + 1].split(",") : [];
    const args = itemAt >= 0 ? rest.slice(0, itemAt) : rest;
    await preview(stage, args[0] ?? path.join(ROOT, "capybara-3d-preview.jpg"), args[1]?.split(","), wear);
  } else {
    await bake(stage);
  }
} finally {
  await stage.browser.close();
}
