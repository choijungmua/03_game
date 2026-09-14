import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BACKGROUND_SPRITES,
  BULLET_SPRITES,
  CAPYBARA_SPRITES,
  ENEMY_SPRITES,
  EXPLOSION_FRAMES,
  FLAME_FRAMES,
  ITEM_SPRITES,
  PLANE_SPRITES,
  SHOT_SPRITES,
  type SpriteKey,
  SPRITES,
  TIER_SPRITES,
} from "./sprites";
import { PLANE_SHOOTER_TIERS } from "./tiers";

/** 게임 안에서 이미지가 쓰이는 자리 전부 */
const ROLES: SpriteKey[] = [
  ...Object.values(PLANE_SPRITES),
  ...FLAME_FRAMES,
  ...Object.values(ENEMY_SPRITES).flatMap((sprite) => [sprite.normal, sprite.hit]),
  ...Object.values(ITEM_SPRITES),
  ...Object.values(BULLET_SPRITES).map((bullet) => bullet.sprite),
  ...Object.values(SHOT_SPRITES),
  ...EXPLOSION_FRAMES,
  ...BACKGROUND_SPRITES,
  ...Object.values(CAPYBARA_SPRITES),
  ...TIER_SPRITES,
];

describe("스프라이트", () => {
  it("한 이미지를 두 자리에 쓰지 않고, 모든 이미지가 어딘가에 쓰인다", () => {
    expect(new Set(ROLES).size).toBe(ROLES.length);
    expect(new Set(ROLES)).toEqual(new Set(Object.keys(SPRITES)));
  });

  it("파일이 실제로 있고, 내용이 서로 다른 그림이다", () => {
    const paths = Object.values(SPRITES);
    expect(new Set(paths).size).toBe(paths.length);

    const hashes = paths.map((sprite) => {
      const file = path.join(process.cwd(), "public", sprite);
      expect(existsSync(file), sprite).toBe(true);
      return createHash("sha1").update(readFileSync(file)).digest("hex");
    });
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it("등급마다 서로 다른 카피바라 그림이 하나씩 있다", () => {
    expect(TIER_SPRITES).toHaveLength(PLANE_SHOOTER_TIERS.length);
  });
});
