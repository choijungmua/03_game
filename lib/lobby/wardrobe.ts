// 로비 옷장: 카피바라 정면(idle-down) 위에 옷 이미지를 겹쳐 입힌다. 로비 맵에서도 입은 옷이 보이고, 다른 플레이어에게도 동기화된다.
// 이미지: public/assets/images/characters/capybara/wardrobe/<slot>/<id>.webp (원본 시트 assets-src/characters/capybara/wardrobe/<slot>*.png)

import type { Facing } from "./world";

export const WARDROBE_SLOTS = ["hat", "glasses", "top", "bottom", "onepiece", "shoes", "gloves"] as const;
export type WardrobeSlot = (typeof WARDROBE_SLOTS)[number];
export type Outfit = Partial<Record<WardrobeSlot, string>>;

/** 옷을 놓을 자리. 캐릭터 이미지(정사각형) 기준 %: x 가운데, bottom 아래 끝, width 폭. mirror면 좌우 뒤집어 그린다 */
export interface WardrobeAnchor {
  x: number;
  bottom: number;
  width: number;
  /** 있으면 폭·높이 상자 안에 비율을 지켜 넣는다 (방향별 그림은 옷마다 가로세로 비율이 달라 폭만으로 맞추면 크기가 들쭉날쭉) */
  height?: number;
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
 * 상의·하의·한벌옷·신발·장갑은 방향마다 따로 그린 그림(wardrobeViewSrc)을 폭·높이 상자에 맞춰 넣는다. 모자·안경은 앞모습 한 장을 옆모습·대각선에서 squeeze로 좁힌다.
 * 신발·장갑은 한 짝 그림을 발·앞발마다 찍는다. 옆·대각선 그림은 오른쪽을 향해 있어 두 짝을 반전하지 않고, 앞·뒤는 반대 짝을 좌우 반전한다.
 * 자리는 서기 스프라이트(capybara-stand-<방향>)의 발·앞발 위치를 잰 값. 뒤·뒤대각선에서는 안경이 안 보여서 없다. 앉은 정면(idle-down)은 SLOT_INFO 자리를 그대로 쓴다
 */
export const WORLD_ANCHORS: Record<WardrobeView, Partial<Record<WardrobeSlot, readonly WardrobeAnchor[]>>> = {
  front: {
    hat: [{ x: 50, bottom: 23, width: 36 }],
    glasses: [{ x: 50, bottom: 42, width: 47 }],
    top: [{ x: 50, bottom: 85, width: 58 }],
    bottom: [{ x: 50, bottom: 88, width: 59 }],
    onepiece: [{ x: 50, bottom: 90, width: 56 }],
    shoes: [
      { x: 31, bottom: 101, width: 17 },
      { x: 67, bottom: 101, width: 17, mirror: true },
    ],
    gloves: [
      { x: 32, bottom: 67, width: 13 },
      { x: 65, bottom: 67, width: 13, mirror: true },
    ],
  },
  back: {
    hat: [{ x: 50, bottom: 23, width: 36 }],
    top: [{ x: 50, bottom: 85, width: 58, height: 42 }],
    bottom: [{ x: 50, bottom: 88, width: 59, height: 34 }],
    onepiece: [{ x: 50, bottom: 90, width: 56, height: 58 }],
    shoes: [
      { x: 40, bottom: 101, width: 17, height: 22 },
      { x: 60, bottom: 101, width: 17, height: 22, mirror: true },
    ],
    gloves: [
      { x: 25, bottom: 67, width: 12, height: 14 },
      { x: 74, bottom: 67, width: 12, height: 14, mirror: true },
    ],
  },
  side: {
    hat: [{ x: 50, bottom: 23, width: 36, squeeze: 0.9 }],
    glasses: [{ x: 68, bottom: 42, width: 26, squeeze: 0.7 }],
    top: [{ x: 45, bottom: 87, width: 56, height: 46 }],
    bottom: [{ x: 45, bottom: 90, width: 56, height: 36 }],
    onepiece: [{ x: 45, bottom: 92, width: 58, height: 62 }],
    shoes: [
      { x: 39, bottom: 100, width: 18, height: 22 },
      { x: 56, bottom: 101, width: 18, height: 22 },
    ],
    gloves: [{ x: 57, bottom: 66, width: 13, height: 14 }],
  },
  front3q: {
    hat: [{ x: 52, bottom: 23, width: 36, squeeze: 0.95 }],
    glasses: [{ x: 59, bottom: 40, width: 40, squeeze: 0.85 }],
    top: [{ x: 51, bottom: 85, width: 56, height: 42 }],
    bottom: [{ x: 51, bottom: 88, width: 56, height: 34 }],
    onepiece: [{ x: 51, bottom: 90, width: 54, height: 58 }],
    shoes: [
      { x: 37, bottom: 100, width: 17, height: 22 },
      { x: 63, bottom: 101, width: 17, height: 22 },
    ],
    gloves: [
      { x: 41, bottom: 66, width: 12, height: 14 },
      { x: 68, bottom: 66, width: 12, height: 14 },
    ],
  },
  back3q: {
    hat: [{ x: 48, bottom: 23, width: 36, squeeze: 0.95 }],
    top: [{ x: 47, bottom: 85, width: 56, height: 42 }],
    bottom: [{ x: 47, bottom: 88, width: 56, height: 34 }],
    onepiece: [{ x: 47, bottom: 90, width: 54, height: 58 }],
    shoes: [
      { x: 33, bottom: 100, width: 17, height: 22 },
      { x: 54, bottom: 101, width: 17, height: 22 },
    ],
    gloves: [
      { x: 21, bottom: 69, width: 11, height: 13 },
      { x: 69, bottom: 65, width: 11, height: 13 },
    ],
  },
};
/** 서 있는 몸 상자의 머리 타원 (이미지 기준 %, side는 오른쪽을 본 그림 기준) */
export const WORLD_HEAD_ELLIPSE: Record<WardrobeView, { x: number; y: number; rx: number; ry: number }> = {
  front: { x: 50, y: 32, rx: 31, ry: 23 },
  back: { x: 50, y: 30, rx: 29, ry: 22 },
  side: { x: 55, y: 30, rx: 23, ry: 22 },
  front3q: { x: 52, y: 31, rx: 27, ry: 22 },
  back3q: { x: 48, y: 30, rx: 26, ry: 22 },
};

export const wardrobeSrc = (slot: WardrobeSlot, id: string) => `/assets/images/characters/capybara/wardrobe/${slot}/${id}.webp`;

/** 방향별 그림이 따로 있는 칸과 방향 (scripts/wardrobe_views.py 로 생성). 정면·앉기는 wardrobeSrc 그림 그대로 */
export const VIEW_ART_SLOTS: readonly WardrobeSlot[] = ["top", "bottom", "onepiece", "shoes", "gloves"];
export const VIEW_ART: readonly WardrobeView[] = ["back", "side", "front3q", "back3q"];

/** 로비 맵에서 그 방향에 쓸 옷 그림. 모자·안경은 앞모습 한 장을 방향마다 자리만 옮겨 쓴다 */
export const wardrobeViewSrc = (slot: WardrobeSlot, id: string, view: WardrobeView) =>
  VIEW_ART_SLOTS.includes(slot) && VIEW_ART.includes(view)
    ? `/assets/images/characters/capybara/wardrobe/${slot}/${id}-${view}.webp`
    : wardrobeSrc(slot, id);

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
