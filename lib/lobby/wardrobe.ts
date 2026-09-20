import { BAKED_FRAMES, type BakedFrame, OUTFIT_SHEET } from "./capybara-3d";
import { drawCharacterGlasses, drawCharacterHat } from "./character-accessories";
import { drawCharacterClothes } from "./character-clothes";
import { characterBaseBounds } from "./character-base";
import { characterFit } from "./character-fit";
import { LOBBY_CHARACTER_BASE } from "./character-style";

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

export const pngOutfitSources = (outfit: Outfit) => outfit.hat ? [outfitSheetSrc("hat", outfit.hat)] : [];

export function drawDressed(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  outfit: Outfit,
  [left, top, size]: readonly [number, number, number],
  imageFor: (src: string) => HTMLImageElement,
) {
  const frame = bakedFrame(base.src);
  if (frame && base.src.includes(`${LOBBY_CHARACTER_BASE}/`)) {
    const [baseLeft, baseTop, baseSize] = characterBaseBounds(frame, [left, top, size]);
    ctx.drawImage(base, baseLeft, baseTop, baseSize, baseSize);
    const fit = characterFit(frame);
    ctx.save();
    ctx.translate(baseLeft, baseTop);
    ctx.scale(baseSize, baseSize);
    if (outfit.onepiece) drawCharacterClothes(ctx, base, { id: outfit.onepiece, fit });
    if (outfit.glasses) drawCharacterGlasses(ctx, { id: outfit.glasses, fit });
    let complete = true;
    if (outfit.hat) {
      const hat = imageFor(outfitSheetSrc("hat", outfit.hat));
      complete = hat.complete && hat.naturalWidth > 0;
      const facing = frame.replace(/^(stand|walk1|walk2|idle|punch|yawn-\d|doze-\d|pick-\d)-/, "");
      const hatFrame = frame.startsWith("scratch") ? "stand-up" : bakedFrame(`capybara-stand-${facing}.webp`) ?? "stand-down";
      if (complete) drawCharacterHat(ctx, hat, { cell: outfitCell(hatFrame), id: outfit.hat, fit });
    }
    ctx.restore();
    return complete;
  }
  ctx.drawImage(base, left, top, size, size);
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
