// @vitest-environment node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { dressSprite, parseOutfit, SLOT_INFO, spriteName, VIEW_ART, WARDROBE_SLOTS, wardrobeSrc, wardrobeViewSrc, wear } from "./wardrobe";
import { ITEM_FIT, SPRITE_FIT } from "./wardrobe-fit";
import { FACINGS } from "./world";

const EVERY_SLOT = { hat: "crown", glasses: "star", top: "hoodie", bottom: "denim", shoes: "sneakers", gloves: "boxing" } as const;

describe("로비 옷장", () => {
  it("옷마다 이미지가 있다", () => {
    for (const slot of WARDROBE_SLOTS) {
      for (const item of SLOT_INFO[slot].items) {
        expect(existsSync(join(process.cwd(), "public", wardrobeSrc(slot, item.id))), `${slot}/${item.id}`).toBe(true);
      }
    }
  });

  it("옷마다 뒤·옆·대각선 그림이 있다", () => {
    for (const slot of WARDROBE_SLOTS) {
      for (const item of SLOT_INFO[slot].items) {
        for (const view of VIEW_ART) {
          const src = wardrobeViewSrc(slot, item.id, view);
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
      const { under, head, over } = dressSprite(sprite, EVERY_SLOT);
      expect(head, sprite).not.toBeNull();
      for (const slot of Object.keys(EVERY_SLOT)) {
        // 뒷모습에서는 안경이 안 보이고, 옆모습에서는 앞발이 하나만 보인다
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

  it("한벌옷을 입으면 상의·하의를 벗고, 상의를 입으면 한벌옷을 벗는다", () => {
    const dressed = wear(wear({ hat: "straw" }, "top", "aloha"), "bottom", "denim");
    expect(wear(dressed, "onepiece", "yukata")).toEqual({ hat: "straw", onepiece: "yukata" });
    expect(wear({ onepiece: "yukata" }, "top", "aloha")).toEqual({ top: "aloha" });
  });

  it("벗으면 그 칸만 빠진다", () => {
    expect(wear({ hat: "straw", shoes: "geta" }, "hat", null)).toEqual({ shoes: "geta" });
  });

  it("저장값에서 모르는 칸·옷·깨진 JSON은 버린다", () => {
    expect(parseOutfit('{"hat":"straw","glasses":"nope","wings":"x"}')).toEqual({ hat: "straw" });
    expect(parseOutfit("{broken")).toEqual({});
    expect(parseOutfit(null)).toEqual({});
  });
});
