import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFENSE_ATLASES,
  DEFENSE_FRAMES,
  REQUIRED_DEFENSE_FRAME_IDS,
  getMonsterTheme,
  isDefenseFrameInsideAtlas,
  type DefenseFrame,
} from "./assets";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

describe("capybara defense atlas", () => {
  it("keeps the lobby icon visibly populated", async () => {
    const file = path.join(
      process.cwd(),
      "public/assets/images/games/capybara-defense/icon.webp",
    );
    expect(existsSync(file)).toBe(true);

    const metadata = await sharp(file).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
    expect(metadata.hasAlpha).toBe(true);
    const { data } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let populatedPixels = 0;
    for (let index = 3; index < data.length; index += 4) {
      if ((data[index] ?? 0) >= 192) populatedPixels += 1;
    }
    expect(populatedPixels).toBeGreaterThan(2_000);
  });

  it("cleans alpha deterministically within the command timeout", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { cleanAlpha } from "./assets-src/games/capybara-defense/atlas-image.mjs";
const input = await readFile("./assets-src/games/capybara-defense/classes.png");
for (let run = 0; run < 2; run += 1) {
  const result = await cleanAlpha(input);
  console.log(createHash("sha256").update(result).digest("hex"));
}`,
      ],
      { cwd: process.cwd(), encoding: "utf8", timeout: 20_000 },
    );
    const hashes = output.trim().split(/\r?\n/);
    expect(hashes).toHaveLength(2);
    expect(hashes[0]).toBe(hashes[1]);
  });

  it("keeps every required frame unique and inside its runtime atlas", async () => {
    const ids = DEFENSE_FRAMES.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(REQUIRED_DEFENSE_FRAME_IDS));

    for (const atlas of Object.values(DEFENSE_ATLASES)) {
      const file = path.join(process.cwd(), "public", atlas.src);
      expect(existsSync(file), atlas.src).toBe(true);
      const metadata = await sharp(file).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(atlas.width);
      expect(metadata.height).toBe(atlas.height);
      expect(statSync(file).size).toBeLessThanOrEqual(atlas.maxBytes);
    }

    for (const frame of DEFENSE_FRAMES) {
      expect(isDefenseFrameInsideAtlas(frame), frame.id).toBe(true);
    }
  });

  it("rejects an out-of-bounds manifest frame", () => {
    const invalidFrame: DefenseFrame = {
      id: "class.scout",
      atlas: "units",
      x: DEFENSE_ATLASES.units.width,
      y: 0,
      width: 1,
      height: 1,
    };

    expect(isDefenseFrameInsideAtlas(invalidFrame)).toBe(false);
  });

  it("preserves alpha in composable gameplay atlases", async () => {
    for (const atlas of Object.values(DEFENSE_ATLASES).filter(({ alpha }) => alpha)) {
      const file = path.join(process.cwd(), "public", atlas.src);
      const metadata = await sharp(readFileSync(file)).metadata();
      expect(metadata.hasAlpha, atlas.src).toBe(true);
      expect(metadata.channels, atlas.src).toBe(4);
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let contaminatedPixels = 0;
      for (let index = 3; index < data.length; index += 4) {
        const alpha = data[index] ?? 0;
        if (alpha > 0 && alpha < 160) contaminatedPixels += 1;
      }
      expect(contaminatedPixels, `${atlas.src} alpha matte`).toBe(0);

      const alpha = Uint8Array.from({ length: info.width * info.height }, (_, pixel) => data[pixel * 4 + 3] ?? 0);
      let chromaticEdgePixels = 0;
      for (let pixel = 0; pixel < alpha.length; pixel += 1) {
        if (alpha[pixel] === 0) continue;
        const red = data[pixel * 4] ?? 0;
        const green = data[pixel * 4 + 1] ?? 0;
        const blue = data[pixel * 4 + 2] ?? 0;
        const chromaticMatte =
          (red > 190 && green < 100 && blue < 100) ||
          (red > 210 && green > 180 && blue < 90) ||
          (green > 170 && red < 100 && blue < 120) ||
          (blue > 170 && green > 130 && red < 100);
        if (!chromaticMatte) continue;
        const x = pixel % info.width;
        const y = Math.floor(pixel / info.width);
        let touchesTransparency = false;
        for (let offsetY = -2; offsetY <= 2 && !touchesTransparency; offsetY += 1) {
          for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
            const nextX = x + offsetX;
            const nextY = y + offsetY;
            if (nextX < 0 || nextX >= info.width || nextY < 0 || nextY >= info.height) continue;
            if ((alpha[nextY * info.width + nextX] ?? 0) === 0) {
              touchesTransparency = true;
              break;
            }
          }
        }
        if (touchesTransparency) chromaticEdgePixels += 1;
      }
      expect(chromaticEdgePixels, `${atlas.src} chromatic edge`).toBe(0);
    }
  });

  it("keeps every registered frame visibly populated", async () => {
    const populated = await Promise.all(
      DEFENSE_FRAMES.map(async (frame) => {
        const atlas = DEFENSE_ATLASES[frame.atlas];
        const file = path.join(process.cwd(), "public", atlas.src);
        const stats = await sharp(file)
          .extract({ left: frame.x, top: frame.y, width: frame.width, height: frame.height })
          .ensureAlpha()
          .stats();
        return [frame.id, stats.channels[3]?.max ?? 0] as const;
      }),
    );
    for (const [id, maximumAlpha] of populated) {
      expect(maximumAlpha, id).toBeGreaterThan(0);
    }
  });

  it("keeps composable silhouettes clear of atlas cell edges", async () => {
    for (const atlasId of ["units", "monsters", "bosses"] as const) {
      const atlas = DEFENSE_ATLASES[atlasId];
      const { data } = await sharp(path.join(process.cwd(), "public", atlas.src))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (const frame of DEFENSE_FRAMES.filter(({ atlas: frameAtlas }) => frameAtlas === atlasId)) {
        let edgePixels = 0;
        for (let x = frame.x; x < frame.x + frame.width; x += 1) {
          if ((data[(frame.y * atlas.width + x) * 4 + 3] ?? 0) > 0) edgePixels += 1;
          if ((data[((frame.y + frame.height - 1) * atlas.width + x) * 4 + 3] ?? 0) > 0) edgePixels += 1;
        }
        for (let y = frame.y; y < frame.y + frame.height; y += 1) {
          if ((data[(y * atlas.width + frame.x) * 4 + 3] ?? 0) > 0) edgePixels += 1;
          if ((data[(y * atlas.width + frame.x + frame.width - 1) * 4 + 3] ?? 0) > 0) edgePixels += 1;
        }
        expect(edgePixels, frame.id).toBe(0);
      }
    }
  });

  it("keeps generated atlases newer than every source sheet", () => {
    const sourceDirectory = path.join(process.cwd(), "assets-src/games/capybara-defense");
    const sourceTimes = [
      "units-ui.png",
      "classes.png",
      "monster-parts.png",
      "bosses.png",
      "maps.png",
      "build-atlases.mjs",
      "atlas-image.mjs",
    ].map((name) => statSync(path.join(sourceDirectory, name)).mtimeMs);
    const newestSource = Math.max(...sourceTimes);

    for (const atlas of Object.values(DEFENSE_ATLASES)) {
      const generatedAt = statSync(path.join(process.cwd(), "public", atlas.src)).mtimeMs;
      expect(generatedAt, atlas.src).toBeGreaterThanOrEqual(newestSource);
    }
  });

  it("composes 100 deterministic themes without adjacent body-only repeats", () => {
    const first = Array.from({ length: 100 }, (_, index) => getMonsterTheme(index + 1));
    const second = Array.from({ length: 100 }, (_, index) => getMonsterTheme(index + 1));

    expect(first).toEqual(second);
    expect(new Set(first.map(({ id }) => id)).size).toBe(100);
    for (let index = 1; index < first.length; index += 1) {
      const previous = first[index - 1];
      const current = first[index];
      expect(current?.body).not.toBe(previous?.body);
      expect(`${current?.face}:${current?.decoration}`).not.toBe(
        `${previous?.face}:${previous?.decoration}`,
      );
    }
  });
});
