// @vitest-environment node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseOutfit, SLOT_INFO, VIEW_OF, WARDROBE_SLOTS, wardrobeSrc, wear, WORLD_ANCHORS } from "./wardrobe";
import { FACINGS } from "./world";

describe("로비 옷장", () => {
  it("옷마다 이미지가 있다", () => {
    for (const slot of WARDROBE_SLOTS) {
      for (const item of SLOT_INFO[slot].items) {
        expect(existsSync(join(process.cwd(), "public", wardrobeSrc(slot, item.id))), `${slot}/${item.id}`).toBe(true);
      }
    }
  });

  it("8방향(대각선 포함) 모두 로비 맵에서 모자 자리가 있다", () => {
    for (const facing of FACINGS) {
      expect(WORLD_ANCHORS[VIEW_OF[facing]].hat?.length, facing).toBeGreaterThan(0);
    }
  });

  it("벗으면 그 칸만 빠진다", () => {
    expect(wear({ hat: "straw", glasses: "heart" }, "hat", null)).toEqual({ glasses: "heart" });
  });

  it("저장값에서 모르는 칸·옷·깨진 JSON은 버린다 (없어진 상의·신발 포함)", () => {
    expect(parseOutfit('{"hat":"straw","glasses":"nope","wings":"x","top":"aloha","shoes":"geta"}')).toEqual({ hat: "straw" });
    expect(parseOutfit("{broken")).toEqual({});
    expect(parseOutfit(null)).toEqual({});
  });
});
