// @vitest-environment node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  dressSprite,
  parseOutfit,
  SLOT_INFO,
  spriteName,
  viewArtOf,
  WARDROBE_SLOTS,
  wardrobeSilhouetteSrc,
  wardrobeSrc,
  wardrobeViewSrc,
  wear,
} from "./wardrobe";
import { ITEM_FIT, SPRITE_FIT } from "./wardrobe-fit";
import { FACINGS } from "./world";

const EVERY_SLOT = { hat: "crown", glasses: "star", onepiece: "dino" } as const;

describe("로비 옷장", () => {
  it("옷마다 이미지가 있다", () => {
    for (const slot of WARDROBE_SLOTS) {
      for (const item of SLOT_INFO[slot].items) {
        expect(existsSync(join(process.cwd(), "public", wardrobeSrc(slot, item.id))), `${slot}/${item.id}`).toBe(true);
      }
    }
  });

  it("옷마다 로비에서 그리는 방향별 그림이 있다", () => {
    for (const slot of WARDROBE_SLOTS) {
      for (const item of SLOT_INFO[slot].items) {
        for (const view of viewArtOf(slot)) {
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

  it("후드형 한벌옷은 모든 방향에서 후드를 정수리까지 올리고 몸통 비율은 유지한다", () => {
    for (const item of SLOT_INFO.onepiece.items) {
      for (const [sprite, fit] of Object.entries(SPRITE_FIT)) {
        const { silhouette, under } = dressSprite(sprite, { onepiece: item.id });
        const fill = under[0];
        const fillBottom = under.at(-1);
        expect(fill, `${sprite} ${item.id} fill`).toBeDefined();
        for (const shell of silhouette) {
          expect(shell.src).toBe(wardrobeSilhouetteSrc(item.id, fit.view));
          expect(existsSync(join(process.cwd(), "public", shell.src)), shell.src).toBe(true);
          expect(shell.left).toBe(fill?.left);
          expect(shell.width).toBe(fill?.width);
          expect(shell.mirror).toBe(fill?.mirror);
        }
        const hooded = ["dino", "shark", "raincoat"].includes(item.id);
        if (hooded) {
          expect(silhouette, `${sprite} ${item.id}`).toHaveLength(2);
          expect(silhouette[0]?.top).toBeCloseTo(fit.head[1] - fit.head[3]);
          expect(silhouette[0]?.crop?.[1]).toBe(0);
          expect((silhouette[0]?.crop?.[3] ?? 0) + (silhouette[1]?.crop?.[3] ?? 0)).toBeCloseTo(1);
          expect(silhouette[0]?.top + (silhouette[0]?.height ?? 0)).toBeCloseTo(silhouette[1]?.top ?? 0);
          expect((silhouette[1]?.top ?? 0) + (silhouette[1]?.height ?? 0)).toBeCloseTo(
            (fillBottom?.top ?? 0) + (fillBottom?.height ?? 0),
          );
        } else {
          expect(silhouette, `${sprite} ${item.id}`).toHaveLength(1);
          expect({ ...silhouette[0], src: fill?.src }).toEqual(fill);
        }
      }
    }
  });

  it("후드형 한벌옷은 앞·옆 얼굴을 후드 구멍으로 보여 주고 뒤통수만 덮는다", () => {
    for (const item of ["dino", "shark", "raincoat"] as const) {
      for (const [sprite, fit] of Object.entries(SPRITE_FIT)) {
        const { face, redraw } = dressSprite(sprite, { onepiece: item });
        const faceIsVisible = fit.view === "front" || fit.view === "front3q" || fit.view === "side";
        expect(redraw, `${sprite} ${item}`).toHaveLength(fit.feet.length);
        expect(face, `${sprite} ${item}`).toHaveLength(faceIsVisible ? 1 : 0);
        if (!faceIsVisible) continue;

        const aperture = face[0]?.clip;
        expect(aperture, `${sprite} ${item} face`).toBeDefined();
        if (fit.view === "front") expect(aperture?.[0]).toBeCloseTo(fit.head[0], 0);
        if (fit.view === "side" || fit.view === "front3q") {
          expect(Math.sign((aperture?.[0] ?? 0) - fit.head[0])).toBe(fit.flip ? -1 : 1);
        }
        if (fit.view === "side") {
          // 옆모습 구멍은 늘려 붙인 후드 조각 앞쪽 안에 있고, 얼굴은 가로세로 같은 비율로 담는다
          const { silhouette } = dressSprite(sprite, { onepiece: item });
          const hood = silhouette[0];
          const [cx = 0, cy = 0, rx = 0, ry = 0] = aperture ?? [];
          expect(cx - rx).toBeGreaterThan(hood?.left ?? 0);
          expect(cx + rx).toBeLessThan((hood?.left ?? 0) + (hood?.width ?? 0));
          expect(cy - ry).toBeGreaterThan(hood?.top ?? 0);
          const [, , sourceRx = 1, sourceRy = 1] = face[0]?.source ?? [];
          expect(rx / sourceRx).toBeCloseTo(ry / sourceRy);
        }
        expect(aperture?.[1]).toBeGreaterThan(fit.head[1]);
        expect(aperture?.[2]).toBeLessThan(fit.head[2]);
        expect(aperture?.[3]).toBeLessThan(fit.head[3]);
      }
    }
  });

  it("딸기·멜빵·유카타는 앞뒤 모두 열린 머리를 보여 준다", () => {
    for (const sprite of ["idle-down", "stand-down", "stand-up", "stand-up-left", "stand-up-right"]) {
      const fit = SPRITE_FIT[sprite];
      for (const item of ["strawberry", "overalls", "yukata"] as const) {
        expect(dressSprite(sprite, { onepiece: item }).redraw.at(-1), `${sprite} ${item}`).toEqual(fit.head);
      }
    }
  });

  it("딸기 뒤쪽은 머리 위에 잎사귀 칼라를 다시 올린다", () => {
    for (const sprite of ["stand-up", "stand-up-left", "stand-up-right", "idle-up"]) {
      const fit = SPRITE_FIT[sprite];
      const strawberry = dressSprite(sprite, { onepiece: "strawberry" });
      expect(strawberry.redraw.at(-1)).toEqual(fit.head);
      expect(strawberry.over[0]?.src).toBe(wardrobeSilhouetteSrc("strawberry", fit.view));
      expect(strawberry.over[0]?.crop?.[1]).toBe(0);
      expect(strawberry.over[0]?.crop?.[3]).toBeGreaterThan(0);
      expect(strawberry.over[0]?.height).toBeLessThan(strawberry.silhouette[0]?.height ?? 0);
    }
  });

  it("한벌옷 아래에서는 다리 전체가 아니라 발바닥 끝만 다시 보인다", () => {
    for (const item of SLOT_INFO.onepiece.items) {
      for (const [sprite, fit] of Object.entries(SPRITE_FIT)) {
        const { redraw } = dressSprite(sprite, { onepiece: item.id });
        for (const [index, foot] of fit.feet.entries()) {
          const paw = redraw[index];
          expect(paw, `${sprite} ${item.id} paw`).toBeDefined();
          expect(paw?.[2]).toBeLessThan(foot[2]);
          expect(paw?.[3]).toBeLessThan(foot[3]);
          expect((paw?.[1] ?? 0) + (paw?.[3] ?? 0)).toBeCloseTo(foot[1] + foot[3]);
        }
      }
    }
  });

  it("서기 8방향과 앉은 정면 스프라이트는 모든 칸이 몸 위에 입혀진다", () => {
    for (const sprite of [...FACINGS.map((facing) => `stand-${facing}`), "idle-down"]) {
      const { under, redraw, over } = dressSprite(sprite, EVERY_SLOT);
      const fit = SPRITE_FIT[sprite];
      expect(redraw, sprite).toHaveLength(fit.feet.length);
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

  it("제거한 모자는 목록과 저장된 옷에서 제외한다", () => {
    const removedHatIds = ["watermelon", "leaf", "beanie"];

    expect(SLOT_INFO.hat.items.map(({ id }) => id)).not.toEqual(expect.arrayContaining(removedHatIds));
    for (const id of removedHatIds) {
      expect(parseOutfit(JSON.stringify({ hat: id }))).toEqual({});
    }
  });
});
