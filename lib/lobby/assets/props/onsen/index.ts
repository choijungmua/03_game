import type { SpriteAsset } from "../../types";

/** 이끼 돌 테두리 유자 온천. 폭은 막는 타원 가로 지름(SPRING_RX 4.6 × 2) + 둥근 돌 여유 0.8. 김·목욕하는 카피바라는 코드로 그린다 */
export default { id: "onsen", category: "props", width: 10 } as const satisfies SpriteAsset;
