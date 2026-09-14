import type { BuildingAsset } from "../../types";

/** 바나나잎 대나무 원두막 + 나무 TV 간판 */
export default {
  id: "hut-3",
  category: "buildings",
  width: 6.8,
  screen: { x: 0.33, y: 0.292, width: 0.26, height: 0.166 },
} as const satisfies BuildingAsset;
