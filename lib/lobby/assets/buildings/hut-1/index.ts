import type { BuildingAsset } from "../../types";

/** 초가 원두막 + 나무 아케이드 간판. 폭은 오두막 칸(BUILDING_WIDTH 6) + 처마 0.8 */
export default {
  id: "hut-1",
  category: "buildings",
  width: 6.8,
  screen: { x: 0.409, y: 0.108, width: 0.196, height: 0.154 },
} as const satisfies BuildingAsset;
