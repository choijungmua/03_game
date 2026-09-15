import type { BuildingAsset } from "../../types";

/** 초가 원두막 + 나무 아케이드 간판. 키가 큰 그림이라 폭을 줄여 세 오두막 높이를 약 290px(카피바라의 4배대)로 맞춘다 */
export default {
  id: "hut-1",
  category: "buildings",
  width: 5.8,
  screen: { x: 0.409, y: 0.108, width: 0.196, height: 0.154 },
} as const satisfies BuildingAsset;
