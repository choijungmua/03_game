import type { BuildingAsset } from "../../types";

/** 바나나잎 대나무 원두막 + 나무 TV 간판. hut-1처럼 키가 커서 폭을 줄여 높이를 맞춘다 */
export default {
  id: "hut-3",
  category: "buildings",
  width: 8,
  screen: { x: 0.363, y: 0.131, width: 0.26, height: 0.217 },
} as const satisfies BuildingAsset;
