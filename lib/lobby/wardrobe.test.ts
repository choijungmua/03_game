// @vitest-environment node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseOutfit, SLOT_INFO, WARDROBE_SLOTS, wardrobeSrc, wear } from "./wardrobe";

describe("로비 옷장", () => {
  it("옷마다 이미지가 있다", () => {
    for (const slot of WARDROBE_SLOTS) {
      for (const item of SLOT_INFO[slot].items) {
        expect(existsSync(join(process.cwd(), "public", wardrobeSrc(slot, item.id))), `${slot}/${item.id}`).toBe(true);
      }
    }
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
