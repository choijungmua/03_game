// @vitest-environment node
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BAKED_FRAMES, BAKED_ITEMS, HEAD_ANCHORS, OUTFIT_SHEET } from "./capybara-3d";
import {
  bakedFrame,
  CHARACTER_3D,
  drawDressed,
  outfitCell,
  outfitSheets,
  outfitSheetSrc,
  parseOutfit,
  SLOT_INFO,
  WARDROBE_SLOTS,
  wardrobeIconSrc,
  wear,
} from "./wardrobe";
import { FACINGS } from "./world";

const require = createRequire(import.meta.url);
// sharp는 next가 이미 설치해 둔 것을 쓴다
const sharp = createRequire(require.resolve("next/package.json"))("sharp") as (file: string) => {
  metadata: () => Promise<{ width?: number; height?: number }>;
};
const publicFile = (src: string) => join(process.cwd(), "public", src);
const everyItem = WARDROBE_SLOTS.flatMap((slot) => SLOT_INFO[slot].items.map((item) => ({ slot, id: item.id })));

describe("로비 옷장 (3D로 구운 옷)", () => {
  it("옷장 목록의 옷은 모두 구워져 있고, 구운 옷은 모두 목록에 있다 (새 옷은 bake.mjs로 굽는다)", () => {
    expect([...BAKED_ITEMS].sort()).toEqual(everyItem.map(({ slot, id }) => `${slot}/${id}`).sort());
    for (const { slot, id } of everyItem) {
      expect(existsSync(publicFile(outfitSheetSrc(slot, id))), `${slot}/${id} 시트`).toBe(true);
      expect(existsSync(publicFile(wardrobeIconSrc(slot, id))), `${slot}/${id} 칸 그림`).toBe(true);
    }
  });

  it("옷 시트는 모든 프레임 칸을 담는 크기다", async () => {
    const { cols, rows, cell } = OUTFIT_SHEET;
    expect(cols * rows).toBeGreaterThanOrEqual(BAKED_FRAMES.length);
    for (const { slot, id } of everyItem) {
      const { width, height } = await sharp(publicFile(outfitSheetSrc(slot, id))).metadata();
      expect([width, height], `${slot}/${id}`).toEqual([cols * cell, rows * cell]);
    }
  });

  it("로비가 그리는 몸 프레임은 모두 구워져 있고 머리 기준점이 그림 안에 있다", () => {
    const lobbyFrames = [
      ...FACINGS.flatMap((facing) => ["stand", "walk1", "walk2"].map((pose) => `${pose}-${facing}`)),
      ...["down", "right", "up", "left"].flatMap((d) => [`idle-${d}`, `punch-${d}`, ...[1, 2, 3].map((n) => `yawn-${n}-${d}`), ...[1, 2].map((n) => `doze-${n}-${d}`)]),
      ...["down", "up"].flatMap((d) => [1, 2, 3].map((n) => `pick-${n}-${d}`)),
      "stun",
      "sleep-1",
      "sleep-2",
      "eating-1",
      "eating-2",
      "scratch-1",
      "scratch-2",
      "scratch-3",
    ];
    expect([...BAKED_FRAMES].sort()).toEqual(lobbyFrames.sort());
    for (const frame of BAKED_FRAMES) {
      expect(existsSync(publicFile(`${CHARACTER_3D}/capybara-${frame}.webp`)), frame).toBe(true);
      for (const [x, y] of Object.values(HEAD_ANCHORS[frame])) {
        expect(x, frame).toBeGreaterThan(0);
        expect(x, frame).toBeLessThan(100);
        expect(y, frame).toBeGreaterThan(0);
        expect(y, frame).toBeLessThan(100);
      }
    }
  });

  it("몸 그림 경로에서 프레임을 찾고, 시트에서 그 프레임 칸을 고른다", () => {
    expect(bakedFrame(`https://ggpli.com${CHARACTER_3D}/capybara-walk1-up-left.webp`)).toBe("walk1-up-left");
    expect(bakedFrame("/x/capybara-reading-left.webp")).toBeUndefined();
    const { cols, cell } = OUTFIT_SHEET;
    expect(outfitCell(BAKED_FRAMES[0])).toEqual([0, 0, cell]);
    expect(outfitCell(BAKED_FRAMES[cols + 1])).toEqual([cell, cell, cell]);
  });

  it("몸 → 한벌옷 → 안경 → 모자 순서로 같은 칸을 겹치고, 덜 받은 시트는 건너뛰며 알려 준다", () => {
    const drawn: string[] = [];
    const ctx = { drawImage: (image: { src: string }, ...args: number[]) => drawn.push(`${image.src}:${args.join(",")}`) } as unknown as CanvasRenderingContext2D;
    const loaded = (src: string) => ({ src, complete: true, naturalWidth: 1 }) as HTMLImageElement;
    const base = loaded(`${CHARACTER_3D}/capybara-stand-right.webp`);
    const outfit = { hat: "crown", glasses: "star", onepiece: "dino" };
    const [sx, sy, cell] = outfitCell("stand-right");

    expect(drawDressed(ctx, base, outfit, [0, 0, 150], loaded)).toBe(true);
    expect(drawn).toEqual([
      `${base.src}:0,0,150,150`,
      ...outfitSheets(outfit).map((src) => `${src}:${sx},${sy},${cell},${cell},0,0,150,150`),
    ]);
    expect(outfitSheets(outfit)).toEqual([outfitSheetSrc("onepiece", "dino"), outfitSheetSrc("glasses", "star"), outfitSheetSrc("hat", "crown")]);

    drawn.length = 0;
    const loading = (src: string) => ({ src, complete: false, naturalWidth: 0 }) as HTMLImageElement;
    expect(drawDressed(ctx, base, { hat: "crown" }, [0, 0, 150], loading)).toBe(false);
    expect(drawn).toEqual([`${base.src}:0,0,150,150`]);
  });

  it("입으면 그 칸만 바뀌고, 벗으면 그 칸만 빠진다", () => {
    expect(wear({ hat: "straw" }, "onepiece", "yukata")).toEqual({ hat: "straw", onepiece: "yukata" });
    expect(wear({ hat: "straw", glasses: "wood" }, "hat", null)).toEqual({ glasses: "wood" });
  });

  it("저장값에서 모르는 칸·옷·깨진 JSON은 버린다 (보류한 상의·신발 저장값도)", () => {
    expect(parseOutfit('{"hat":"straw","glasses":"nope","wings":"x","top":"hoodie","shoes":"geta"}')).toEqual({ hat: "straw" });
    expect(parseOutfit("{broken")).toEqual({});
    expect(parseOutfit(null)).toEqual({});
  });

  it("제거한 모자는 목록과 저장된 옷에서 제외한다", () => {
    const removedHatIds = ["watermelon", "leaf", "beanie"];

    expect(SLOT_INFO.hat.items.map(({ id }) => id)).not.toEqual(expect.arrayContaining(removedHatIds));
    for (const id of removedHatIds) {
      expect(parseOutfit(JSON.stringify({ hat: id }))).toEqual({});
    }
  });
});
