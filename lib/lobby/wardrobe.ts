// 로비 옷장: 3D 카피바라(assets-src/characters/capybara-3d)와 같은 뼈에 입혀 프레임마다 구운 옷 그림을 몸 그림 위에 겹친다.
// 옷은 몸과 같은 자세·방향으로 구워져 있어 자리를 맞출 게 없다 — 같은 프레임 칸을 그대로 겹치면 끝.
// 몸: public/assets/images/characters/capybara-3d/capybara-<프레임>.webp
// 옷: public/assets/images/characters/capybara-3d/wardrobe/<칸>/<id>.webp (프레임 순서대로 칸을 늘어놓은 시트, lib/lobby/capybara-3d.ts)
// 새 옷·새 동작: items.js·frames.js에 넣고 `node assets-src/characters/capybara-3d/bake.mjs`

import { BAKED_FRAMES, type BakedFrame, OUTFIT_SHEET } from "./capybara-3d";

// 칸을 늘리려면(상의·신발…) 여기와 items.js에 넣고 다시 굽는다. 겹치는 순서는 LAYER_ORDER
export const WARDROBE_SLOTS = ["hat", "glasses", "onepiece"] as const;
export type WardrobeSlot = (typeof WARDROBE_SLOTS)[number];
export type Outfit = Partial<Record<WardrobeSlot, string>>;

interface WardrobeItem {
  id: string;
  label: string;
  /** 눈길 끄는 특별한 옷 — 목록에서 반짝이 표시 */
  special?: boolean;
}

export const SLOT_INFO: Record<WardrobeSlot, { label: string; items: readonly WardrobeItem[] }> = {
  hat: {
    label: "모자",
    items: [
      { id: "crown", label: "황금 왕관", special: true },
      { id: "yuzu-towel", label: "유자 온천 수건", special: true },
      { id: "straw", label: "밀짚모자" },
    ],
  },
  glasses: {
    label: "안경",
    items: [
      { id: "star", label: "별 선글라스", special: true },
      { id: "rainbow", label: "무지개 파티 안경", special: true },
      { id: "goggles", label: "물안경", special: true },
      { id: "wood", label: "나무테 안경" },
      { id: "sunglasses", label: "선글라스" },
      { id: "heart", label: "하트 안경" },
    ],
  },
  onepiece: {
    label: "한벌옷",
    items: [
      { id: "dino", label: "공룡 잠옷", special: true },
      { id: "shark", label: "상어 잠옷", special: true },
      { id: "strawberry", label: "딸기 옷", special: true },
      { id: "raincoat", label: "개구리 우비" },
      { id: "overalls", label: "멜빵바지" },
      { id: "yukata", label: "유카타" },
    ],
  },
};

/** 겹치는 순서: 한벌옷 → 안경 → 모자 */
const LAYER_ORDER: readonly WardrobeSlot[] = ["onepiece", "glasses", "hat"];

export const CHARACTER_3D = "/assets/images/characters/capybara-3d";
/** 옷 시트 (모든 프레임) */
export const outfitSheetSrc = (slot: WardrobeSlot, id: string) => `${CHARACTER_3D}/wardrobe/${slot}/${id}.webp`;
/** 옷장 칸 그림 (옷 입은 모습) */
export const wardrobeIconSrc = (slot: WardrobeSlot, id: string) => `${CHARACTER_3D}/wardrobe/${slot}/${id}-icon.webp`;

/** 몸 그림 경로(…/capybara-<프레임>.webp)에서 구운 프레임 이름. 구운 프레임이 아니면 undefined */
export function bakedFrame(src: string): BakedFrame | undefined {
  const name = /capybara-([^/.]+)\.webp/.exec(src)?.[1];
  return BAKED_FRAMES.find((frame) => frame === name);
}

/** 옷 시트에서 그 프레임 칸 [x, y, 한 변] (px) */
export function outfitCell(frame: BakedFrame): readonly [number, number, number] {
  const index = BAKED_FRAMES.indexOf(frame);
  const { cols, cell } = OUTFIT_SHEET;
  return [(index % cols) * cell, Math.floor(index / cols) * cell, cell];
}

/** 입은 옷 시트들을 겹칠 순서대로 */
export const outfitSheets = (outfit: Outfit) =>
  LAYER_ORDER.flatMap((slot) => {
    const id = outfit[slot];
    return id ? [outfitSheetSrc(slot, id)] : [];
  });

/**
 * 몸 그림(base) 위에 입은 옷을 겹쳐 (left, top, size) 정사각형에 그린다. 몸과 옷은 같은 프레임·같은 틀로 구워져 칸을 그대로 겹친다.
 * 옷 시트가 아직 안 받아졌으면 false (몸만 그려진다)
 */
export function drawDressed(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  outfit: Outfit,
  [left, top, size]: readonly [number, number, number],
  imageFor: (src: string) => HTMLImageElement,
) {
  ctx.drawImage(base, left, top, size, size);
  const frame = bakedFrame(base.src);
  if (!frame) return true;
  const [sx, sy, cell] = outfitCell(frame);
  let complete = true;
  for (const src of outfitSheets(outfit)) {
    const sheet = imageFor(src);
    if (!sheet.complete || sheet.naturalWidth === 0) {
      complete = false;
      continue;
    }
    ctx.drawImage(sheet, sx, sy, cell, cell, left, top, size, size);
  }
  return complete;
}

/** 입거나(id) 벗는다(null) */
export function wear(outfit: Outfit, slot: WardrobeSlot, id: string | null): Outfit {
  const next: Outfit = { ...outfit };
  if (id === null) delete next[slot];
  else next[slot] = id;
  return next;
}

/** 바깥 입력(저장값·네트워크)에서 아는 칸·아는 옷만 남긴다 */
export function sanitizeOutfit(saved: Partial<Record<string, string>> | null | undefined): Outfit {
  let outfit: Outfit = {};
  if (!saved || typeof saved !== "object") return outfit;
  for (const slot of WARDROBE_SLOTS) {
    const id = saved[slot];
    if (typeof id === "string" && SLOT_INFO[slot].items.some((item) => item.id === id)) outfit = wear(outfit, slot, id);
  }
  return outfit;
}

export function parseOutfit(raw: string | null): Outfit {
  try {
    const parsed: Partial<Record<string, string>> | null = JSON.parse(raw ?? "{}");
    return sanitizeOutfit(parsed);
  } catch {
    return {};
  }
}

const STORAGE_KEY = "lobby-outfit-v1";

export function loadOutfit(): Outfit {
  try {
    return parseOutfit(localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

export function saveOutfit(outfit: Outfit) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(outfit));
  } catch {}
}
