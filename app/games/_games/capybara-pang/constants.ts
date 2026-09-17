import type { SoundLayer } from "@/lib/lobby/settings";

export const BOARD_SIZE = 7;

/** 동물 펠트 얼굴 그림 폴더. 평소 얼굴은 <key>.webp, 터질 때 우는 얼굴은 <key>-cry.webp */
export const ANIMAL_IMAGE_BASE = "/assets/images/games/capybara-pang/animals";

/** 판에 나오는 동물. 색 원 위에 펠트 얼굴 그림을 얹는다 (색만으로 구분하지 않게 얼굴 모양도 다르다) */
export const ANIMALS = [
  { key: "capybara", name: "카피바라", colorClass: "bg-amber-600 text-white" },
  { key: "rabbit", name: "토끼", colorClass: "bg-pink-400 text-neutral-950" },
  { key: "cat", name: "고양이", colorClass: "bg-orange-400 text-neutral-950" },
  { key: "dog", name: "강아지", colorClass: "bg-sky-500 text-neutral-950" },
  { key: "chick", name: "병아리", colorClass: "bg-yellow-300 text-neutral-950" },
  { key: "pig", name: "돼지", colorClass: "bg-rose-300 text-neutral-950" },
  { key: "monkey", name: "원숭이", colorClass: "bg-lime-500 text-neutral-950" },
] as const;

export const KIND_COUNT = ANIMALS.length;

/** 한 판 시간 */
export const ROUND_SECONDS = 60;

/** 블록 한 개 점수 */
export const TILE_POINTS = 10;
/** 콤보 1단계마다 더하는 점수, 이 단계까지만 늘어난다 */
export const COMBO_BONUS_POINTS = 10;
export const COMBO_BONUS_CAP = 10;
/** 마지막으로 터진 뒤 이 시간 안에 또 터뜨려야 콤보가 이어진다 */
export const COMBO_WINDOW_MS = 2000;
/** 콤보가 이 수의 배수가 될 때마다 피버 */
export const FEVER_COMBO = 10;
export const FEVER_MS = 8000;
export const FEVER_MULTIPLIER = 2;

/** 바꾸기·터지기·떨어지기 애니메이션 시간 */
export const SWAP_MS = 140;
export const POP_MS = 160;
export const FALL_MS = 220;

/** 이 시간 동안 아무것도 안 하면 둘 수 있는 자리를 반짝여 알려준다 */
export const HINT_DELAY_MS = 5000;

/** 끌어서 바꾸기로 보는 최소 거리 (블록 크기 대비) */
export const DRAG_THRESHOLD = 0.35;

/** 결과 화면이 뜬 뒤 이 시간 동안은 탭·Space·Enter로 다시 시작하지 않는다 */
export const RESULT_TAP_GUARD_MS = 1000;
/** 시간 끝 소리 뒤에 결과 소리가 이어지도록 미루는 시간 */
export const RESULT_SOUND_DELAY_MS = 380;
/** 이 등급 순서(PANG_TIERS 인덱스)부터는 결과 소리를 실패로 낸다 */
export const FAIL_TIER_INDEX = 3;

export const PANG_SOUNDS = {
  /** 팡: 블록이 터짐 */
  pop: [
    { kind: "tone", wave: "sine", from: 700, to: 1400, ms: 90, level: 0.12 },
    { kind: "noise", filter: "bandpass", q: 2, from: 2400, to: 1600, ms: 60, level: 0.08 },
  ],
  /** 삐―: 시간 끝 */
  timeUp: [
    { kind: "tone", wave: "square", from: 523, to: 523, ms: 320, level: 0.07 },
    { kind: "tone", wave: "sine", from: 1046, to: 1040, ms: 320, level: 0.08 },
  ],
} as const satisfies Record<string, readonly SoundLayer[]>;
