// 로비 옷장: 카피바라 정면(idle-down) 위에 옷 이미지를 겹쳐 입힌다. 로비 맵에서도 입은 옷이 보이고, 다른 플레이어에게도 동기화된다.
// 이미지: public/assets/images/characters/capybara/wardrobe/<slot>/<id>.webp (원본 시트 assets-src/characters/capybara/wardrobe/<slot>*.png)

import type { Direction } from "./world";

export const WARDROBE_SLOTS = ["hat", "glasses", "top", "bottom", "onepiece", "shoes", "gloves"] as const;
export type WardrobeSlot = (typeof WARDROBE_SLOTS)[number];
export type Outfit = Partial<Record<WardrobeSlot, string>>;

/** 옷을 놓을 자리. 캐릭터 이미지(정사각형) 기준 %: x 가운데, bottom 아래 끝, width 폭. mirror면 좌우 뒤집어 그린다 */
export interface WardrobeAnchor {
  x: number;
  bottom: number;
  width: number;
  mirror?: boolean;
  /** 가로만 이 비율로 좁힌다 (높이는 width 기준 그대로). 앞모습 옷을 옆모습에 쓸 때 */
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
  top: {
    label: "상의",
    anchors: [{ x: 50, bottom: 82, width: 74 }],
    items: [
      { id: "marching", label: "마칭밴드 재킷", special: true },
      { id: "hero", label: "히어로 티", special: true },
      { id: "cloud", label: "구름 스웨터", special: true },
      { id: "knit-vest", label: "줄무늬 조끼" },
      { id: "aloha", label: "나뭇잎 셔츠" },
      { id: "hoodie", label: "노란 후드" },
    ],
  },
  bottom: {
    label: "하의",
    anchors: [{ x: 50, bottom: 85, width: 76 }],
    items: [
      { id: "duck-swim", label: "오리 수영바지", special: true },
      { id: "tutu", label: "반짝이 튀튀", special: true },
      { id: "pumpkin", label: "호박 반바지", special: true },
      { id: "denim", label: "청 반바지" },
      { id: "check", label: "체크 반바지" },
      { id: "grass-skirt", label: "풀잎 치마" },
    ],
  },
  onepiece: {
    label: "한벌옷",
    anchors: [{ x: 50, bottom: 87, width: 72 }],
    items: [
      { id: "dino", label: "공룡 잠옷", special: true },
      { id: "shark", label: "상어 잠옷", special: true },
      { id: "strawberry", label: "딸기 옷", special: true },
      { id: "raincoat", label: "개구리 우비" },
      { id: "overalls", label: "멜빵바지" },
      { id: "yukata", label: "유카타" },
    ],
  },
  shoes: {
    label: "신발",
    anchors: [
      { x: 27, bottom: 98, width: 22 },
      { x: 73, bottom: 98, width: 22, mirror: true },
    ],
    items: [
      { id: "rocket", label: "로켓 부츠", special: true },
      { id: "flippers", label: "오리발", special: true },
      { id: "bunny", label: "토끼 슬리퍼", special: true },
      { id: "rain-boots", label: "장화" },
      { id: "sneakers", label: "운동화" },
      { id: "geta", label: "나막신" },
    ],
  },
  gloves: {
    label: "장갑",
    anchors: [
      { x: 35, bottom: 71, width: 16 },
      { x: 64, bottom: 71, width: 16, mirror: true },
    ],
    items: [
      { id: "crab", label: "게 집게", special: true },
      { id: "cat-paw", label: "고양이 발 장갑", special: true },
      { id: "champion", label: "챔피언 글러브", special: true },
      { id: "mitten", label: "벙어리장갑" },
      { id: "rubber", label: "고무장갑" },
      { id: "boxing", label: "권투 글러브" },
    ],
  },
};

/**
 * 겹쳐 그리는 순서 (아래 → 위). 몸 옷 위에 카피바라 머리(HEAD_ELLIPSE)를 한 번 더 그려서 옷이 턱 밑으로 들어가 보이게 한다.
 * 신발은 하의·한벌옷 밑단 아래에 깔고 밑단을 발 위에서 끝내서 신발 앞코만 보이게 한다 (위에 그리면 옷 다리 위로 겹쳐 보인다)
 */
export const BODY_LAYERS: readonly WardrobeSlot[] = ["shoes", "bottom", "top", "onepiece"];
export const OVER_HEAD_LAYERS: readonly WardrobeSlot[] = ["gloves", "glasses", "hat"];
/** 머리 타원 (이미지 기준 %): 가운데 x·y, 반지름 rx·ry */
export const HEAD_ELLIPSE = { x: 50, y: 28, rx: 40, ry: 23 } as const;
export const HEAD_CLIP = `ellipse(${HEAD_ELLIPSE.rx}% ${HEAD_ELLIPSE.ry}% at ${HEAD_ELLIPSE.x}% ${HEAD_ELLIPSE.y}%)`;

/** 스프라이트가 보여 주는 몸 방향. 옆모습 자리는 오른쪽을 본 그림 기준이고 왼쪽은 좌우 반전해 쓴다 */
export type WardrobeView = "front" | "back" | "side";
export const VIEW_OF: Record<Direction, WardrobeView> = { down: "front", up: "back", left: "side", right: "side" };

/**
 * 로비 맵의 서기·걷기·때리기·긁기·졸기 스프라이트(모두 같은 몸 상자 x21–78%, y9–97%)에 얹는 자리.
 * 옷 그림은 방향과 상관없이 앞모습 한 장을 쓴다 — 뒷모습은 그대로(뒤에서 봐도 옷 윤곽이 거의 같다), 옆모습은 squeeze로 좁힌다.
 * front는 옷장 자리(SLOT_INFO)를 서 있는 몸 상자로 옮긴 값. 뒤에서는 안경이 안 보여서 back에 없다.
 * 앉은 정면(idle-down)은 옷장 미리보기와 같은 그림이라 SLOT_INFO 자리를 그대로 쓴다
 */
export const WORLD_ANCHORS: Record<WardrobeView, Partial<Record<WardrobeSlot, readonly WardrobeAnchor[]>>> = {
  front: {
    hat: [{ x: 50, bottom: 23, width: 36 }],
    glasses: [{ x: 50, bottom: 42, width: 47 }],
    top: [{ x: 50, bottom: 85, width: 58 }],
    bottom: [{ x: 50, bottom: 88, width: 59 }],
    onepiece: [{ x: 50, bottom: 90, width: 56 }],
    shoes: [
      { x: 32, bottom: 101, width: 17 },
      { x: 68, bottom: 101, width: 17, mirror: true },
    ],
    gloves: [
      { x: 38, bottom: 74, width: 12.5 },
      { x: 61, bottom: 74, width: 12.5, mirror: true },
    ],
  },
  back: {
    hat: [{ x: 50, bottom: 23, width: 36 }],
    top: [{ x: 50, bottom: 85, width: 58 }],
    bottom: [{ x: 50, bottom: 88, width: 59 }],
    onepiece: [{ x: 50, bottom: 90, width: 56 }],
    shoes: [
      { x: 38, bottom: 101, width: 17 },
      { x: 62, bottom: 101, width: 17, mirror: true },
    ],
    gloves: [
      { x: 26, bottom: 70, width: 11 },
      { x: 74, bottom: 70, width: 11, mirror: true },
    ],
  },
  side: {
    hat: [{ x: 50, bottom: 23, width: 36, squeeze: 0.9 }],
    glasses: [{ x: 68, bottom: 42, width: 26, squeeze: 0.7 }],
    top: [{ x: 46, bottom: 87, width: 70, squeeze: 0.8 }],
    bottom: [{ x: 46, bottom: 90, width: 70, squeeze: 0.8 }],
    onepiece: [{ x: 46, bottom: 92, width: 66, squeeze: 0.8 }],
    shoes: [{ x: 50, bottom: 101, width: 22, squeeze: 0.9 }],
    gloves: [{ x: 60, bottom: 64, width: 13 }],
  },
};
/** 서 있는 몸 상자의 머리 타원 (이미지 기준 %, side는 오른쪽을 본 그림 기준) */
export const WORLD_HEAD_ELLIPSE: Record<WardrobeView, { x: number; y: number; rx: number; ry: number }> = {
  front: { x: 50, y: 32, rx: 31, ry: 23 },
  back: { x: 50, y: 30, rx: 29, ry: 22 },
  side: { x: 55, y: 30, rx: 23, ry: 22 },
};

export const wardrobeSrc = (slot: WardrobeSlot, id: string) => `/assets/images/characters/capybara/wardrobe/${slot}/${id}.webp`;

/** 입거나(id) 벗는다(null). 한벌옷은 상의·하의와 함께 입을 수 없어서 서로 벗긴다 */
export function wear(outfit: Outfit, slot: WardrobeSlot, id: string | null): Outfit {
  const next: Outfit = { ...outfit };
  if (id === null) {
    delete next[slot];
    return next;
  }
  next[slot] = id;
  if (slot === "onepiece") {
    delete next.top;
    delete next.bottom;
  } else if (slot === "top" || slot === "bottom") {
    delete next.onepiece;
  }
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
