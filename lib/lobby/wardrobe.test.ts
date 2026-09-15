// @vitest-environment node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { dressSprite, outfitImageSrcs, parseOutfit, SLOT_INFO, spriteName, WARDROBE_SLOTS, wear } from "./wardrobe";
import { ITEM_FIT, SPRITE_FIT } from "./wardrobe-fit";
import { FACINGS } from "./world";

const EVERY_SLOT = { hat: "crown", glasses: "star", onepiece: "dino" } as const;

describe("로비 옷장", () => {
  it("옷마다 로비에서 쓰는 그림(정면·방향별·한벌옷 채운 그림)이 있다", () => {
    for (const slot of WARDROBE_SLOTS) {
      for (const item of SLOT_INFO[slot].items) {
        for (const src of outfitImageSrcs(slot, item.id)) {
          expect(existsSync(join(process.cwd(), "public", src)), src).toBe(true);
        }
      }
    }
  });

  it("옷마다 모든 묶음에 맞춘 상자가 있다 (새 옷을 넣으면 scripts/wardrobe_fit.py 를 다시 돌린다)", () => {
    for (const slot of WARDROBE_SLOTS) {
      for (const item of SLOT_INFO[slot].items) {
        expect(ITEM_FIT[`${slot}/${item.id}`]?.front?.length, `${slot}/${item.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("서기 8방향과 앉은 정면 스프라이트는 모든 칸이 몸 위에 입혀진다", () => {
    for (const sprite of [...FACINGS.map((facing) => `stand-${facing}`), "idle-down"]) {
      const { under, redraw, over } = dressSprite(sprite, EVERY_SLOT);
      // 발 달린 공룡 잠옷이라 머리만 다시 그리고, 한벌옷은 몸 윤곽 안 채운 그림 + 자르지 않는 원래 그림 두 조각
      expect(redraw.length, sprite).toBe(1);
      expect(under.map((piece) => piece.clip), sprite).toEqual([true, false]);
      for (const slot of Object.keys(EVERY_SLOT)) {
        // 뒷모습에서는 안경이 안 보인다
        if (slot === "glasses" && sprite.startsWith("stand-up")) continue;
        expect([...under, ...over].some((piece) => piece.src.includes(`/wardrobe/${slot}/`)), `${sprite} ${slot}`).toBe(true);
      }
      for (const piece of [...under, ...over]) {
        // 옷 가운데는 스프라이트 안에 있다
        expect(piece.left + piece.width / 2, `${sprite} ${piece.src}`).toBeGreaterThan(0);
        expect(piece.left + piece.width / 2, `${sprite} ${piece.src}`).toBeLessThan(100);
        expect(piece.top + piece.height / 2, `${sprite} ${piece.src}`).toBeGreaterThan(0);
        expect(piece.top + piece.height / 2, `${sprite} ${piece.src}`).toBeLessThan(100);
      }
    }
  });

  it("로비가 옷을 입히는 스프라이트 이미지마다 기준점이 있다", () => {
    for (const name of Object.keys(SPRITE_FIT)) {
      expect(existsSync(join(process.cwd(), "public/assets/images/characters/capybara", `capybara-${name}.webp`)), name).toBe(true);
    }
    expect(spriteName("https://ggpli.com/assets/images/characters/capybara/capybara-walk1-up-left.webp")).toBe("walk1-up-left");
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
});
