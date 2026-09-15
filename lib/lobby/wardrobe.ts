// 로비 옷장: 카피바라 스프라이트 위에 옷 이미지를 겹쳐 입힌다. 로비 맵에서도 입은 옷이 보이고, 다른 플레이어에게도 동기화된다.
// 이미지: public/assets/images/characters/capybara/wardrobe/<slot>/<id>.webp (원본 시트 assets-src/characters/capybara/wardrobe/<slot>*.png)
// 자리: 스프라이트마다 잰 몸 기준점 × 옷마다 몸에 맞춘 상자 (wardrobe-fit.ts, scripts/wardrobe_fit.py 로 생성)

import { ITEM_FIT, SPRITE_FIT } from "./wardrobe-fit";

export const WARDROBE_SLOTS = ["hat", "glasses", "top", "bottom", "onepiece", "shoes", "gloves"] as const;
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
  top: {
    label: "상의",
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
 * 겹쳐 그리는 순서 (아래 → 위). 몸 옷 위에 카피바라 머리(스프라이트마다 잰 머리 타원)를 한 번 더 그려서 옷이 턱 밑으로 들어가 보이게 한다.
 * 신발은 하의·한벌옷 밑단 아래에 깔고 밑단을 발 위에서 끝내서 신발 앞코만 보이게 한다 (위에 그리면 옷 다리 위로 겹쳐 보인다)
 */
export const BODY_LAYERS: readonly WardrobeSlot[] = ["shoes", "bottom", "top", "onepiece"];
export const OVER_HEAD_LAYERS: readonly WardrobeSlot[] = ["gloves", "glasses", "hat"];

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
export interface SpriteFit {
  view: WardrobeView;
  group: FitGroup;
  flip: boolean;
  /** 머리 타원 [cx, cy, rx, ry] (%) */
  head: readonly [number, number, number, number];
  /** 모자: 머리 꼭대기 (폭 자리에 머리 높이) */
  hat: readonly FitPoint[];
  /** 안경: 두 눈 가운데 (폭 자리에 머리 높이). 뒷모습은 없다 */
  glasses: readonly FitPoint[];
  /** 상의·하의·한벌옷: 몸통 가운데·발바닥 */
  top: readonly FitPoint[];
  /** 발마다 */
  shoes: readonly FitPoint[];
  /** 보이는 앞발마다 */
  gloves: readonly FitPoint[];
}
const ANCHOR: Record<WardrobeSlot, "hat" | "glasses" | "top" | "shoes" | "gloves"> = {
  hat: "hat",
  glasses: "glasses",
  top: "top",
  bottom: "top",
  onepiece: "top",
  shoes: "shoes",
  gloves: "gloves",
};

export const wardrobeSrc = (slot: WardrobeSlot, id: string) => `/assets/images/characters/capybara/wardrobe/${slot}/${id}.webp`;

/** 옷마다 방향별 그림이 따로 있다 (scripts/wardrobe_views.py 로 생성). 정면·앉은 정면은 wardrobeSrc 그림 그대로 */
export const VIEW_ART: readonly WardrobeView[] = ["back", "side", "front3q", "back3q"];

/** 로비 맵에서 그 방향에 쓸 옷 그림 */
export const wardrobeViewSrc = (slot: WardrobeSlot, id: string, view: WardrobeView) =>
  VIEW_ART.includes(view) ? `/assets/images/characters/capybara/wardrobe/${slot}/${id}-${view}.webp` : wardrobeSrc(slot, id);

/** 옷 한 조각을 그릴 자리 — 스프라이트 이미지 %: 왼쪽·위 끝, 폭·높이. mirror면 좌우 뒤집어 그린다 */
export interface OutfitPiece {
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  mirror: boolean;
}

/** 스프라이트 이미지 경로(…/capybara-<이름>.webp)에서 <이름> */
export const spriteName = (src: string) => /capybara-([^/.]+)\.webp/.exec(src)?.[1] ?? "";

/**
 * 스프라이트 한 장에 입힐 옷. under(몸 옷) → head(머리 타원으로 머리를 다시 그림, 몸 옷을 입었을 때만) → over(장갑·안경·모자) 순서로 그린다.
 * 기준점이 없는 스프라이트나 안 보이는 칸(뒷모습 안경, 안 보이는 앞발)은 빠진다.
 * 옆·대각선 그림은 왼쪽을 보는 스프라이트에서 반전하고, 앞·뒤에서는 두 번째 짝(신발·장갑)을 반전한다
 */
export function dressSprite(sprite: string, outfit: Outfit): { under: OutfitPiece[]; head: SpriteFit["head"] | null; over: OutfitPiece[] } {
  const fit = SPRITE_FIT[sprite];
  const pieces = (slots: readonly WardrobeSlot[]) =>
    slots.flatMap((slot) => {
      const id = outfit[slot];
      const rels = fit && id ? ITEM_FIT[`${slot}/${id}`]?.[fit.group] : undefined;
      if (!fit || !id || !rels?.length) return [];
      return fit[ANCHOR[slot]].map(([cx, y, w], index): OutfitPiece => {
        const [dx, dy, relWidth, relHeight] = rels[Math.min(index, rels.length - 1)];
        const width = relWidth * w;
        const height = relHeight * w;
        return {
          src: wardrobeViewSrc(slot, id, fit.view),
          left: cx + (fit.flip ? -dx : dx) * w - width / 2,
          top: y + dy * w - height,
          width,
          height,
          mirror: (index === 1 && (fit.view === "front" || fit.view === "back")) !== fit.flip,
        };
      });
    });
  return { under: pieces(BODY_LAYERS), head: fit && BODY_LAYERS.some((slot) => outfit[slot]) ? fit.head : null, over: pieces(OVER_HEAD_LAYERS) };
}

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
