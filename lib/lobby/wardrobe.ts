// 로비 옷장: 카피바라 스프라이트 위에 옷 이미지를 겹쳐 입힌다. 로비 맵에서도 입은 옷이 보이고, 다른 플레이어에게도 동기화된다.
// 이미지: public/assets/images/characters/capybara/wardrobe/<slot>/<id>.webp (원본 시트 assets-src/characters/capybara/wardrobe/<slot>*.png)
// 자리: 스프라이트마다 잰 몸 기준점 × 옷마다 몸에 맞춘 상자 (wardrobe-fit.ts, scripts/wardrobe_fit.py 로 생성)

import { ITEM_FIT, SPRITE_FIT } from "./wardrobe-fit";

// 상의·하의·신발·장갑은 보류 (그림은 public/.../wardrobe 에 남아 있다). 칸을 다시 넣으면 scripts/wardrobe_fit.py 를 다시 돌린다
export const WARDROBE_SLOTS = ["hat", "glasses", "onepiece"] as const;
export type WardrobeSlot = (typeof WARDROBE_SLOTS)[number];
export type Outfit = Partial<Record<WardrobeSlot, string>>;

interface WardrobeItem {
  id: string;
  label: string;
  /** 눈길 끄는 특별한 옷 — 목록에서 반짝이 표시 */
  special?: boolean;
  /** 한벌옷에 발까지 달려 있다 — 카피바라 발을 옷 위에 다시 그리지 않는다 */
  coversFeet?: boolean;
}

export const SLOT_INFO: Record<WardrobeSlot, { label: string; items: readonly WardrobeItem[] }> = {
  hat: {
    label: "모자",
    items: [
      { id: "crown", label: "황금 왕관", special: true },
      { id: "yuzu-towel", label: "유자 온천 수건", special: true },
      { id: "watermelon", label: "수박 헬멧", special: true },
      { id: "straw", label: "밀짚모자" },
      { id: "leaf", label: "잎사귀 모자" },
      { id: "beanie", label: "털실 비니" },
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
      { id: "dino", label: "공룡 잠옷", special: true, coversFeet: true },
      { id: "shark", label: "상어 잠옷", special: true, coversFeet: true },
      { id: "strawberry", label: "딸기 옷", special: true, coversFeet: true },
      { id: "raincoat", label: "개구리 우비" },
      { id: "overalls", label: "멜빵바지" },
      { id: "yukata", label: "유카타" },
    ],
  },
};

/** 겹쳐 그리는 순서 (아래 → 위). 한벌옷 위에 카피바라 머리(스프라이트마다 잰 머리 타원)를 한 번 더 그려서 옷이 턱 밑으로 들어가 보이게 한다 */
export const BODY_LAYERS: readonly WardrobeSlot[] = ["onepiece"];
export const OVER_HEAD_LAYERS: readonly WardrobeSlot[] = ["glasses", "hat"];

/**
 * 스프라이트가 보여 주는 몸 방향. front3q·back3q는 앞·뒤 대각선(3/4 시점).
 * 옆모습·대각선 옷 그림은 오른쪽을 본 그림이고, 왼쪽을 보는 스프라이트에서는 좌우 반전해 쓴다
 */
export type WardrobeView = "front" | "back" | "side" | "front3q" | "back3q";
/** 옷 상자를 맞춘 묶음: 서 있는 방향 5개 + 앉은 앞·옆·뒤. 같은 묶음의 동작(걷기·때리기·하품·졸기…)은 같은 상대 상자를 쓴다 */
export type FitGroup = WardrobeView | "sit-front" | "sit-side" | "sit-back";
/** 기준점 [가운데 x, y, 폭] — 스프라이트 이미지 % */
export type FitPoint = readonly [number, number, number];
/** 기준점에 붙이는 옷 상자 [dx, dy(아래 끝), 폭, 높이] — 기준점 폭 단위, dx는 오른쪽 보기 기준 */
export type FitRel = readonly [number, number, number, number];
/** 타원 [cx, cy, rx, ry] — 스프라이트 이미지 % */
export type FitEllipse = readonly [number, number, number, number];
export interface SpriteFit {
  view: WardrobeView;
  group: FitGroup;
  flip: boolean;
  /** 머리 타원. 한벌옷 위에 머리를 다시 그린다 */
  head: FitEllipse;
  /** 보이는 발마다 타원. 한벌옷 위에 발을 다시 그린다 (앉은 뒷모습은 없다) */
  feet: readonly FitEllipse[];
  /** 모자: 머리 꼭대기 (폭 자리에 머리 높이) */
  hat: readonly FitPoint[];
  /** 안경: 두 눈 가운데 (폭 자리에 머리 높이). 뒷모습은 없다 */
  glasses: readonly FitPoint[];
  /** 한벌옷: 몸통 가운데·발바닥 */
  top: readonly FitPoint[];
}
const ANCHOR: Record<WardrobeSlot, "hat" | "glasses" | "top"> = { hat: "hat", glasses: "glasses", onepiece: "top" };

export const wardrobeSrc = (slot: WardrobeSlot, id: string) => `/assets/images/characters/capybara/wardrobe/${slot}/${id}.webp`;

/** 옷마다 방향별 그림이 따로 있다 (scripts/wardrobe_views.py 로 생성). 정면·앉은 정면은 wardrobeSrc 그림 그대로 */
export const VIEW_ART: readonly WardrobeView[] = ["back", "side", "front3q", "back3q"];
/** 칸마다 로비에서 그리는 방향별 그림. 안경은 뒤·뒤대각선에서 안 보여 옆·앞대각선만 있다 */
export const viewArtOf = (slot: WardrobeSlot): readonly WardrobeView[] => (slot === "glasses" ? ["side", "front3q"] : VIEW_ART);

/** 로비 맵에서 그 방향에 쓸 옷 그림 */
export const wardrobeViewSrc = (slot: WardrobeSlot, id: string, view: WardrobeView) =>
  VIEW_ART.includes(view) ? `/assets/images/characters/capybara/wardrobe/${slot}/${id}-${view}.webp` : wardrobeSrc(slot, id);

/** 한벌옷 그림의 빈틈을 옷 색으로 채운 그림 (scripts/wardrobe_fit.py). 몸 윤곽 안에만 깔아 옷 사이로 몸이 비치지 않게 한다 */
export const wardrobeFillSrc = (id: string, view: WardrobeView) => `/assets/images/characters/capybara/wardrobe/onepiece/${id}-${view}-fill.webp`;

/** 그 옷을 입었을 때 로비가 쓰는 그림 전부 (미리 불러오기용): 정면 + 방향별 + 한벌옷의 채운 그림 */
export const outfitImageSrcs = (slot: WardrobeSlot, id: string) => [
  wardrobeSrc(slot, id),
  ...viewArtOf(slot).map((view) => wardrobeViewSrc(slot, id, view)),
  ...(slot === "onepiece" ? (["front", ...VIEW_ART] as const).map((view) => wardrobeFillSrc(id, view)) : []),
];

/** 옷 한 조각을 그릴 자리 — 스프라이트 이미지 %: 왼쪽·위 끝, 폭·높이. mirror면 좌우 뒤집어 그린다. clip이면 스프라이트 윤곽 안에만 그린다 */
export interface OutfitPiece {
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  mirror: boolean;
  clip: boolean;
}

/** 스프라이트 이미지 경로(…/capybara-<이름>.webp)에서 <이름> */
export const spriteName = (src: string) => /capybara-([^/.]+)\.webp/.exec(src)?.[1] ?? "";

/**
 * 스프라이트 한 장에 입힐 옷. under(한벌옷) → redraw(발·머리 타원만큼 스프라이트를 다시 그림, 한벌옷을 입었을 때만) → over(안경·모자) 순서로 그린다.
 * 한벌옷은 두 조각이다: 빈틈을 채운 그림을 몸 윤곽 안에만 깔아(clip) 몸이 비치지 않게 하고, 원래 그림을 그 위에 자르지 않고 그려
 * 후드·꼬리·소매·넉넉한 품이 몸 밖으로 나오게 한다. 발까지 달린 옷(coversFeet)은 카피바라 발을 다시 그리지 않는다.
 * 기준점이 없는 스프라이트나 안 보이는 칸(뒷모습 안경)은 빠진다.
 * 옷 그림은 스프라이트가 바라보는 방향의 그림을 쓰고, 옆·대각선 그림은 왼쪽을 보는 스프라이트에서 반전한다
 */
export function dressSprite(sprite: string, outfit: Outfit): { under: OutfitPiece[]; redraw: readonly FitEllipse[]; over: OutfitPiece[] } {
  const fit = SPRITE_FIT[sprite];
  const pieces = (slots: readonly WardrobeSlot[]) =>
    slots.flatMap((slot) => {
      const id = outfit[slot];
      const rels = fit && id ? ITEM_FIT[`${slot}/${id}`]?.[fit.group] : undefined;
      if (!fit || !id || !rels?.length) return [];
      return fit[ANCHOR[slot]].flatMap(([cx, y, w], index): OutfitPiece[] => {
        const [dx, dy, relWidth, relHeight] = rels[Math.min(index, rels.length - 1)];
        const width = relWidth * w;
        const height = relHeight * w;
        const box = { left: cx + (fit.flip ? -dx : dx) * w - width / 2, top: y + dy * w - height, width, height, mirror: fit.flip };
        const art = { ...box, src: wardrobeViewSrc(slot, id, fit.view), clip: false };
        return slot === "onepiece" ? [{ ...box, src: wardrobeFillSrc(id, fit.view), clip: true }, art] : [art];
      });
    });
  const onepiece = SLOT_INFO.onepiece.items.find((item) => item.id === outfit.onepiece);
  return {
    under: pieces(BODY_LAYERS),
    redraw: fit && onepiece ? [...(onepiece.coversFeet ? [] : fit.feet), fit.head] : [],
    over: pieces(OVER_HEAD_LAYERS),
  };
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
