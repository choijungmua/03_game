// 로비 옷장: 카피바라 정면(idle-down) 위에 옷 이미지를 겹쳐 입힌다.
// 이미지: public/assets/images/characters/capybara/wardrobe/<slot>/<id>.webp (원본 시트 assets-src/characters/capybara/wardrobe/<slot>.png)

export const WARDROBE_SLOTS = ["hat", "glasses", "top", "bottom", "onepiece", "shoes", "gloves"] as const;
export type WardrobeSlot = (typeof WARDROBE_SLOTS)[number];
export type Outfit = Partial<Record<WardrobeSlot, string>>;

/** 옷을 놓을 자리. 캐릭터 이미지(정사각형) 기준 %: x 가운데, bottom 아래 끝, width 폭. mirror면 좌우 뒤집어 그린다 */
interface Anchor {
  x: number;
  bottom: number;
  width: number;
  mirror?: boolean;
}

export const SLOT_INFO: Record<WardrobeSlot, { label: string; anchors: readonly Anchor[]; items: readonly { id: string; label: string }[] }> = {
  hat: {
    label: "모자",
    anchors: [{ x: 50, bottom: 19, width: 46 }],
    items: [
      { id: "straw", label: "밀짚모자" },
      { id: "leaf", label: "잎사귀 모자" },
      { id: "beanie", label: "털실 비니" },
    ],
  },
  glasses: {
    label: "안경",
    anchors: [{ x: 50, bottom: 38, width: 60 }],
    items: [
      { id: "wood", label: "나무테 안경" },
      { id: "sunglasses", label: "선글라스" },
      { id: "heart", label: "하트 안경" },
    ],
  },
  top: {
    label: "상의",
    anchors: [{ x: 50, bottom: 82, width: 74 }],
    items: [
      { id: "knit-vest", label: "줄무늬 조끼" },
      { id: "aloha", label: "나뭇잎 셔츠" },
      { id: "hoodie", label: "노란 후드" },
    ],
  },
  bottom: {
    label: "하의",
    anchors: [{ x: 50, bottom: 94, width: 76 }],
    items: [
      { id: "denim", label: "청 반바지" },
      { id: "check", label: "체크 반바지" },
      { id: "grass-skirt", label: "풀잎 치마" },
    ],
  },
  onepiece: {
    label: "한벌옷",
    anchors: [{ x: 50, bottom: 98, width: 72 }],
    items: [
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
      { id: "mitten", label: "벙어리장갑" },
      { id: "rubber", label: "고무장갑" },
      { id: "boxing", label: "권투 글러브" },
    ],
  },
};

/** 겹쳐 그리는 순서 (아래 → 위). 몸 옷 위에 카피바라 머리(HEAD_CLIP 타원)를 한 번 더 그려서 옷이 턱 밑으로 들어가 보이게 한다 */
export const BODY_LAYERS: readonly WardrobeSlot[] = ["bottom", "top", "onepiece"];
export const OVER_HEAD_LAYERS: readonly WardrobeSlot[] = ["shoes", "gloves", "glasses", "hat"];
export const HEAD_CLIP = "ellipse(40% 23% at 50% 28%)";

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

/** localStorage 값에서 아는 칸·아는 옷만 남긴다 */
export function parseOutfit(raw: string | null): Outfit {
  let saved: Partial<Record<string, string>> = {};
  try {
    const parsed: Partial<Record<string, string>> | null = JSON.parse(raw ?? "{}");
    if (parsed && typeof parsed === "object") saved = parsed;
  } catch {}
  let outfit: Outfit = {};
  for (const slot of WARDROBE_SLOTS) {
    const id = saved[slot];
    if (typeof id === "string" && SLOT_INFO[slot].items.some((item) => item.id === id)) outfit = wear(outfit, slot, id);
  }
  return outfit;
}
