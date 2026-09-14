// @vitest-environment node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BUILDING_ASSETS, GROUND_ASSETS, lobbyAssetSrc, SPRITE_ASSETS } from ".";

const ALL = [...GROUND_ASSETS, ...SPRITE_ASSETS, ...BUILDING_ASSETS];

describe("로비 에셋 레지스트리", () => {
  it("에셋마다 자기 폴더에 이미지가 있다", () => {
    for (const asset of ALL) expect(existsSync(join(process.cwd(), "public", lobbyAssetSrc(asset))), asset.id).toBe(true);
  });

  it("id가 겹치지 않는다", () => {
    expect(new Set(ALL.map((asset) => asset.id)).size).toBe(ALL.length);
  });
});
