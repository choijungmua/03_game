import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cleanAlpha, splitGrid } from "./atlas-image.mjs";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(sourceDir, "../../..");
const outputDir = path.join(root, "public/assets/images/games/capybara-defense");
const evidenceDir = path.join(root, ".omo/evidence");

await Promise.all([mkdir(outputDir, { recursive: true }), mkdir(evidenceDir, { recursive: true })]);

for (const name of ["units-ui.png", "classes.png", "monster-parts.png", "bosses.png"]) {
  const file = path.join(sourceDir, name);
  const cleaned = await cleanAlpha(file);
  await sharp(cleaned).png().toFile(file);
}

const unitsBase = await sharp(path.join(sourceDir, "units-ui.png"))
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const unitGrid = await splitGrid(unitsBase, {
  columns: 8,
  rowStops: [0, 0.25, 0.5, 0.75, 1],
  width: 1024,
  height: 1024,
  padding: 12,
});
const classSheet = await sharp(path.join(sourceDir, "classes.png"))
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const classes = await splitGrid(classSheet, { columns: 4, rowStops: [0, 1], width: 512, height: 256, padding: 12 });
const upperEquipment = await sharp(unitGrid)
  .extract({ left: 512, top: 0, width: 512, height: 256 })
  .png()
  .toBuffer();
const lowerUnits = await sharp(unitGrid)
  .extract({ left: 0, top: 256, width: 1024, height: 768 })
  .png()
  .toBuffer();
const units = await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: classes, left: 0, top: 0 },
    { input: upperEquipment, left: 512, top: 0 },
    { input: lowerUnits, left: 0, top: 256 },
  ])
  .png()
  .toBuffer();
const monsterSource = await sharp(path.join(sourceDir, "monster-parts.png"))
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const monsters = await splitGrid(monsterSource, {
  columns: 5,
  rowStops: [0, 0.23, 0.43, 0.55, 0.67, 0.83, 1],
  width: 1200,
  height: 1200,
  padding: 12,
});
const bossSource = await sharp(path.join(sourceDir, "bosses.png"))
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const bosses = await splitGrid(bossSource, {
  columns: 5,
  rowStops: [0, 0.493, 1],
  width: 1000,
  height: 500,
  padding: 12,
});
const [cleanUnits, cleanMonsters, cleanBosses] = await Promise.all([
  cleanAlpha(units),
  cleanAlpha(monsters),
  cleanAlpha(bosses),
]);
const icon = await sharp(cleanUnits)
  .extract({ left: 0, top: 0, width: 128, height: 256 })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize(224, 224, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const cleanIcon = await cleanAlpha(icon);
const compressedMonsters = await sharp(cleanMonsters)
  .webp({ nearLossless: true, quality: 90, effort: 6 })
  .toBuffer();
const finalMonsters = await cleanAlpha(compressedMonsters);

await Promise.all([
  sharp(cleanUnits)
    .webp({ lossless: true })
    .toFile(path.join(outputDir, "units-ui.webp")),
  sharp(finalMonsters)
    .webp({ lossless: true, effort: 6 })
    .toFile(path.join(outputDir, "monster-parts.webp")),
  sharp(cleanBosses)
    .webp({ lossless: true })
    .toFile(path.join(outputDir, "bosses.webp")),
  sharp(cleanIcon).webp({ lossless: true }).toFile(path.join(outputDir, "icon.webp")),
]);

const mapStrip = await sharp(path.join(sourceDir, "maps.png"))
  .resize(1536, 768, { fit: "fill" })
  .png()
  .toBuffer();
const pathTiles = await Promise.all(
  [0, 1, 2].map((column) =>
    sharp(mapStrip)
      .extract({ left: column * 512 + 128, top: 256, width: 256, height: 256 })
      .png()
      .toBuffer(),
  ),
);
await sharp({
  create: { width: 1536, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: mapStrip, left: 0, top: 0 },
    ...pathTiles.map((input, index) => ({ input, left: index * 256, top: 768 })),
  ])
  .webp({ quality: 88, alphaQuality: 100 })
  .toFile(path.join(outputDir, "maps.webp"));

const reviewFrames = await Promise.all(
  [0, 1, 2, 3, 8, 9, 10, 11, 12, 13].map((index) =>
    sharp(cleanUnits)
      .extract({ left: (index % 8) * 128, top: Math.floor(index / 8) * 256, width: 128, height: 256 })
      .resize(96, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
  ),
);
const originalRow = await sharp({
  create: { width: 1040, height: 200, channels: 4, background: "#f4ead8" },
})
  .composite(reviewFrames.map((input, index) => ({ input, left: 8 + index * 103, top: 4 })))
  .png()
  .toBuffer();
const grayscaleRow = await sharp(originalRow).grayscale().png().toBuffer();
const deuteranopiaRow = await sharp(originalRow)
  .recomb([
    [0.625, 0.375, 0],
    [0.7, 0.3, 0],
    [0, 0.3, 0.7],
  ])
  .png()
  .toBuffer();
await sharp({ create: { width: 1040, height: 600, channels: 4, background: "#f4ead8" } })
  .composite([
    { input: originalRow, left: 0, top: 0 },
    { input: grayscaleRow, left: 0, top: 200 },
    { input: deuteranopiaRow, left: 0, top: 400 },
  ])
  .png()
  .toFile(path.join(evidenceDir, "task-5-defense-atlas.png"));

const [unitsPreview, monstersPreview, bossesPreview, mapsPreview] = await Promise.all([
  sharp(path.join(outputDir, "units-ui.webp")).resize(700, 700, { fit: "contain" }).png().toBuffer(),
  sharp(path.join(outputDir, "monster-parts.webp")).resize(700, 700, { fit: "contain" }).png().toBuffer(),
  sharp(path.join(outputDir, "bosses.webp")).resize(800, 400, { fit: "contain" }).png().toBuffer(),
  sharp(path.join(outputDir, "maps.webp")).resize(900, 600, { fit: "contain" }).png().toBuffer(),
]);
await sharp({ create: { width: 1800, height: 1400, channels: 4, background: "#f4ead8" } })
  .composite([
    { input: unitsPreview, left: 50, top: 40 },
    { input: monstersPreview, left: 900, top: 40 },
    { input: bossesPreview, left: 20, top: 900 },
    { input: mapsPreview, left: 880, top: 780 },
  ])
  .png()
  .toFile(path.join(evidenceDir, "task-5-defense-runtime-atlases.png"));

const alphaPreviews = await Promise.all([
  sharp(path.join(outputDir, "units-ui.webp")).resize(500, 500, { fit: "contain" }).png().toBuffer(),
  sharp(path.join(outputDir, "monster-parts.webp")).resize(500, 500, { fit: "contain" }).png().toBuffer(),
  sharp(path.join(outputDir, "bosses.webp")).resize(700, 350, { fit: "contain" }).png().toBuffer(),
]);
const checker = Buffer.alloc(1800 * 700 * 4);
for (let y = 0; y < 700; y += 1) {
  for (let x = 0; x < 1800; x += 1) {
    const tone = (Math.floor(x / 32) + Math.floor(y / 32)) % 2 === 0 ? 226 : 188;
    const pixel = (y * 1800 + x) * 4;
    checker[pixel] = tone;
    checker[pixel + 1] = tone;
    checker[pixel + 2] = tone;
    checker[pixel + 3] = 255;
  }
}
await sharp({ create: { width: 1800, height: 1400, channels: 4, background: "#151a17" } })
  .composite([
    { input: checker, raw: { width: 1800, height: 700, channels: 4 }, left: 0, top: 700 },
    ...alphaPreviews.flatMap((input, index) => [
      { input, left: index * 550, top: 80 },
      { input, left: index * 550, top: 780 },
    ]),
  ])
  .png()
  .toFile(path.join(evidenceDir, "task-5-defense-alpha-check.png"));

console.log("Built 4 defense atlases and the class/tier contact sheet.");
