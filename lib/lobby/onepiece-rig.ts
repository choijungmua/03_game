import type { FacePatch, FitEllipse, OutfitPiece, WardrobeView } from "./wardrobe";

type FaceOpening = {
  readonly centerX: number;
  readonly centerY: number;
  readonly radiusX: number;
  readonly radiusY: number;
};

type HoodProfile = {
  readonly id: string;
  readonly back: number;
  readonly back3q: number;
  /** 앞·앞대각선 얼굴 구멍: 머리 타원 기준 비율 */
  readonly face: Readonly<Partial<Record<"front" | "front3q", FaceOpening>>>;
  /** 옆모습 얼굴 구멍: 옆모습 옷 그림(오른쪽 보기)에서 잰 후드 안쪽 — 그림 폭·높이 비율 */
  readonly sideOpening: FaceOpening;
};

type OnepieceRigFrame = {
  readonly piece: OutfitPiece;
  readonly id: string;
  readonly view: WardrobeView;
  readonly headTop: number;
};

/** 옆모습 구멍에 담는 얼굴 높이 — 머리 반지름(ry) 배수 */
const SIDE_FACE_HEIGHT = 1.1;

const HOOD_PROFILES: readonly HoodProfile[] = [
  {
    id: "dino",
    back: 0.4,
    back3q: 0.42,
    face: {
      front: { centerX: 0, centerY: 0.26, radiusX: 0.72, radiusY: 0.64 },
      front3q: { centerX: 0.16, centerY: 0.24, radiusX: 0.68, radiusY: 0.64 },
    },
    sideOpening: { centerX: 0.78, centerY: 0.21, radiusX: 0.1, radiusY: 0.09 },
  },
  {
    id: "shark",
    back: 0.38,
    back3q: 0.4,
    face: {
      front: { centerX: 0, centerY: 0.25, radiusX: 0.7, radiusY: 0.62 },
      front3q: { centerX: 0.16, centerY: 0.24, radiusX: 0.66, radiusY: 0.62 },
    },
    sideOpening: { centerX: 0.73, centerY: 0.32, radiusX: 0.12, radiusY: 0.08 },
  },
  {
    id: "raincoat",
    back: 0.38,
    back3q: 0.38,
    face: {
      front: { centerX: 0, centerY: 0.27, radiusX: 0.72, radiusY: 0.7 },
      front3q: { centerX: 0.18, centerY: 0.25, radiusX: 0.68, radiusY: 0.68 },
    },
    sideOpening: { centerX: 0.81, centerY: 0.3, radiusX: 0.11, radiusY: 0.09 },
  },
];

function hoodSplit(id: string, view: WardrobeView) {
  const profile = HOOD_PROFILES.find((candidate) => candidate.id === id);
  if (!profile) return undefined;
  if (view === "back3q") return profile.back3q;
  return profile.back;
}

function collarSplit(id: string, view: WardrobeView) {
  if (id !== "strawberry") return undefined;
  if (view === "back") return 0.3;
  if (view === "back3q") return 0.31;
  return undefined;
}

export function onepieceCoversHead(id: string) {
  return HOOD_PROFILES.some((profile) => profile.id === id);
}

/** 옷 그림 좌표(폭·높이 비율)를 늘려 붙인 조각들 위의 스프라이트 % 자리로 옮긴다 */
function artToSprite(pieces: readonly OutfitPiece[], { centerX, centerY, radiusX, radiusY }: FaceOpening): FitEllipse | undefined {
  const piece = pieces.find(({ crop = [0, 0, 1, 1] }) => centerY >= crop[1] && centerY <= crop[1] + crop[3]);
  if (!piece) return undefined;
  const [, cropTop, , cropHeight] = piece.crop ?? [0, 0, 1, 1];
  const scaleY = piece.height / cropHeight;
  const x = piece.mirror ? 1 - centerX : centerX;
  return [piece.left + x * piece.width, piece.top + (centerY - cropTop) * scaleY, radiusX * piece.width, radiusY * scaleY];
}

/**
 * 후드 구멍에 보일 얼굴. 앞·앞대각선은 머리 타원 기준, 옆모습은 옷 그림의 후드 안쪽에 맞춘다
 * (옆모습 후드는 머리 꼭대기까지 늘려 붙여 머리 타원과 입구 자리가 어긋나기 때문).
 * source는 스프라이트에서 떠 올 얼굴 자리로, 가로세로를 같은 비율로 줄여 얼굴이 찌그러지지 않는다
 */
export function onepieceFace(
  id: string,
  view: WardrobeView,
  head: FitEllipse,
  mirror: boolean,
  hood: readonly OutfitPiece[],
): FacePatch | undefined {
  const profile = HOOD_PROFILES.find((candidate) => candidate.id === id);
  if (!profile) return undefined;
  const [cx, cy, rx, ry] = head;
  const direction = mirror ? -1 : 1;
  if (view === "side") {
    const clip = artToSprite(hood, profile.sideOpening);
    if (!clip) return undefined;
    // 옆얼굴(눈·코)을 머리 반지름의 SIDE_FACE_HEIGHT 배만큼 떠서 구멍 높이에 맞춘다
    const scale = clip[3] / (ry * SIDE_FACE_HEIGHT);
    return { source: [cx + rx * 0.3 * direction, cy + ry * 0.12, clip[2] / scale, clip[3] / scale], clip };
  }
  if (view !== "front" && view !== "front3q") return undefined;
  const opening = profile.face[view];
  if (!opening) return undefined;
  const clip: FitEllipse = [
    cx + rx * opening.centerX * direction,
    cy + ry * opening.centerY,
    rx * opening.radiusX,
    ry * opening.radiusY,
  ];
  const source: FitEllipse =
    view === "front3q"
      ? [cx + rx * 0.08 * direction, cy + ry * 0.18, rx * 0.78, ry * 0.78]
      : [cx, cy + ry * 0.18, rx * 0.82, ry * 0.78];
  return { source, clip };
}

export function rigOnepieceSilhouette({ piece, id, view, headTop }: OnepieceRigFrame): readonly OutfitPiece[] {
  const split = hoodSplit(id, view);
  if (split === undefined) return [piece];

  const bottom = piece.top + piece.height;
  const seam = piece.top + piece.height * split;

  return [
    {
      ...piece,
      top: headTop,
      height: seam - headTop,
      crop: [0, 0, 1, split],
    },
    {
      ...piece,
      top: seam,
      height: bottom - seam,
      crop: [0, split, 1, 1 - split],
    },
  ];
}

export function rigOnepieceCollar(piece: OutfitPiece, id: string, view: WardrobeView): readonly OutfitPiece[] {
  const split = collarSplit(id, view);
  if (split === undefined) return [];
  return [{ ...piece, height: piece.height * split, crop: [0, 0, 1, split] }];
}
