// 로비 맵 에셋 한 개의 정의. 에셋 하나 = 폴더 하나:
//   lib/lobby/assets/<category>/<id>/index.ts            ← 이 정의
//   public/assets/images/lobby/<category>/<id>/image.webp ← 게임용 이미지
//   assets-src/lobby/<category>/<id>/source.png           ← 생성 원본(있으면)
// 나중에 유저가 에셋을 만들어도 같은 모양의 데이터 한 건이면 로비에 들어간다

/** ground: 바닥 텍스처, nature: 바깥 습지 자연물, props: 마을 소품, buildings: 게임 오두막 */
export type LobbyAssetCategory = "ground" | "nature" | "props" | "buildings";

/** 바닥 텍스처. 192×192, 월드 192px(4타일)마다 반복 */
export interface GroundAsset {
  id: string;
  category: "ground";
  /** 텍스처가 아직 없을 때 잠깐 쓰는 단색 */
  fallbackColor: string;
}

/** 가운데·바닥 기준으로 세워 그리는 그림 */
export interface SpriteAsset {
  id: string;
  category: Exclude<LobbyAssetCategory, "ground">;
  /** 그릴 폭(타일 배수). 높이는 이미지 비율대로 */
  width: number;
  /** 바닥선 보정(px). +면 아래로 */
  offsetY?: number;
}

/** 게임 오두막. 간판 화면 자리에 그 게임 아이콘을 그린다 */
export interface BuildingAsset extends SpriteAsset {
  category: "buildings";
  /** 이미지 안 간판 화면 영역(이미지 크기 대비 0~1) */
  screen: { x: number; y: number; width: number; height: number };
}

export type LobbyAsset = GroundAsset | SpriteAsset;
