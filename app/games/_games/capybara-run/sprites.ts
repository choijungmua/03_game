// slice.py가 만든 파일. 고치지 말고 시트를 바꾼 뒤 다시 실행한다
/** 그림 이름 → [가로, 세로](px). 같은 시트끼리 상대 크기가 맞는다 */
export const SPRITE_SIZES = {
  "run-1": [305, 208],
  "run-2": [236, 188],
  "run-3": [304, 201],
  "run-4": [255, 210],
  "jump": [204, 286],
  "tumble": [206, 199],
  "slide": [320, 137],
  "hang": [147, 294],
  "coin": [214, 214],
  "thorn": [289, 210],
  "log": [291, 177],
  "branch": [164, 320],
  "step": [269, 220],
  "heart": [259, 216],
  "cliff": [179, 300],
  "crown": [279, 224],
} as const;

export type SpriteName = keyof typeof SPRITE_SIZES;
