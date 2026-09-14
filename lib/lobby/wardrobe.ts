// 로비 옷장: 카피바라 정면(idle-down) 위에 모자·안경 이미지를 겹쳐 씌운다. 로비 맵에서도 쓴 게 보이고, 다른 플레이어에게도 동기화된다.
// 이미지: public/assets/images/characters/capybara/wardrobe/<slot>/<id>.webp (원본 시트 assets-src/characters/capybara/wardrobe/<slot>*.png)

import type { Facing } from "./world";

export const WARDROBE_SLOTS = ["hat", "glasses"] as const;
export type WardrobeSlot = (typeof WARDROBE_SLOTS)[number];
export type Outfit = Partial<Record<WardrobeSlot, string>>;

/** 옷을 놓을 자리. 캐릭터 이미지(정사각형) 기준 %: x 가운데, bottom 아래 끝, width 폭 */
export interface WardrobeAnchor {
  x: number;
  bottom: number;
  width: number;
  /** 가로만 이 비율로 좁힌다 (높이는 width 기준 그대로). 앞모습 그림을 옆모습에 쓸 때 */
  squeeze?: number;
}

interface WardrobeItem {
  id: string;
  label: string;
  /** 눈길 끄는 특별한 옷 — 목록에서 반짝이 표시 */
  special?: boolean;
}

export const SLOT_INFO: Record<WardrobeSlot, { label: string; anchors: readonly WardrobeAnchor[]; items: readonly WardrobeItem[] }> = {
  hat: {
    label: "모자",
    anchors: [{ x: 50, bottom: 19, width: 46 }],
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
    anchors: [{ x: 50, bottom: 38, width: 60 }],
    items: [
      { id: "star", label: "별 선글라스", special: true },
      { id: "rainbow", label: "무지개 파티 안경", special: true },
      { id: "goggles", label: "물안경", special: true },
      { id: "wood", label: "나무테 안경" },
      { id: "sunglasses", label: "선글라스" },
      { id: "heart", label: "하트 안경" },
    ],
  },
};

/** 겹쳐 그리는 순서 (아래 → 위). 모자가 안경 테 위로 온다 */
export const DRAW_ORDER: readonly WardrobeSlot[] = ["glasses", "hat"];

/**
 * 스프라이트가 보여 주는 몸 방향. front3q·back3q는 앞·뒤 대각선(3/4 시점).
 * 옆모습·대각선 자리는 오른쪽을 본 그림 기준이고, 왼쪽을 보는 방향은 좌우 반전해 쓴다
 */
export type WardrobeView = "front" | "back" | "side" | "front3q" | "back3q";
export const VIEW_OF: Record<Facing, WardrobeView> = {
  down: "front",
  up: "back",
  left: "side",
  right: "side",
  "down-left": "front3q",
  "down-right": "front3q",
  "up-left": "back3q",
  "up-right": "back3q",
};

/**
 * 로비 맵의 서기·걷기·때리기·긁기·졸기 스프라이트(모두 같은 몸 상자 x21–78%, y9–97%)에 얹는 자리.
 * 그림은 방향과 상관없이 앞모습 한 장을 쓴다 — 뒷모습은 그대로, 옆모습·대각선은 squeeze로 좁힌다.
 * front는 옷장 자리(SLOT_INFO)를 서 있는 몸 상자로 옮긴 값. 뒤·뒤대각선에서는 안경이 안 보여서 없다.
 * 대각선 자리는 서기·걷기 대각선 스프라이트(capybara-stand-down-right 등) 기준. 앉은 정면(idle-down)은 SLOT_INFO 자리를 그대로 쓴다
 */
export const WORLD_ANCHORS: Record<WardrobeView, Partial<Record<WardrobeSlot, readonly WardrobeAnchor[]>>> = {
  front: {
    hat: [{ x: 50, bottom: 23, width: 36 }],
    glasses: [{ x: 50, bottom: 42, width: 47 }],
  },
  back: {
    hat: [{ x: 50, bottom: 23, width: 36 }],
  },
  side: {
    hat: [{ x: 50, bottom: 23, width: 36, squeeze: 0.9 }],
    glasses: [{ x: 68, bottom: 42, width: 26, squeeze: 0.7 }],
  },
  front3q: {
    hat: [{ x: 52, bottom: 23, width: 36, squeeze: 0.95 }],
    glasses: [{ x: 59, bottom: 40, width: 40, squeeze: 0.85 }],
  },
  back3q: {
    hat: [{ x: 48, bottom: 23, width: 36, squeeze: 0.95 }],
  },
};

export const wardrobeSrc = (slot: WardrobeSlot, id: string) => `/assets/images/characters/capybara/wardrobe/${slot}/${id}.webp`;

/** 쓰거나(id) 벗는다(null) */
export function wear(outfit: Outfit, slot: WardrobeSlot, id: string | null): Outfit {
  const next: Outfit = { ...outfit };
  if (id === null) delete next[slot];
  else next[slot] = id;
  return next;
}

/** 바깥 입력(저장값·네트워크)에서 아는 칸·아는 옷만 남긴다 (예전 상의·신발 등 저장값도 여기서 빠진다) */
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
