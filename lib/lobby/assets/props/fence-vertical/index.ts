import type { SpriteAsset } from "../../types";

/**
 * 세로로 뻗은 갈대 울타리: 기둥 + 남쪽 이웃 기둥까지 한 칸 내려가는 갈대 판(옆에서 본 띠).
 * 그림 바닥이 기둥보다 한 타일 아래라 offsetY로 기둥을 제 칸 바닥에 맞춘다. props/fence 원본을 잘라 붙여 만듦
 */
export default { id: "fence-vertical", category: "props", width: 0.644, offsetY: 50 } as const satisfies SpriteAsset;
