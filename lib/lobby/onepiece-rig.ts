import type { FitEllipse, OutfitPiece, WardrobeView } from "./wardrobe";

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
  readonly face: Readonly<Partial<Record<WardrobeView, FaceOpening>>>;
};

type OnepieceRigFrame = {
  readonly piece: OutfitPiece;
  readonly id: string;
  readonly view: WardrobeView;
  readonly headTop: number;
};

const HOOD_PROFILES: readonly HoodProfile[] = [
  {
    id: "dino",
    back: 0.4,
    back3q: 0.42,
    face: {
      front: { centerX: 0, centerY: 0.26, radiusX: 0.72, radiusY: 0.64 },
      front3q: { centerX: 0.16, centerY: 0.24, radiusX: 0.68, radiusY: 0.64 },
      side: { centerX: 0.45, centerY: 0.42, radiusX: 0.28, radiusY: 0.44 },
    },
  },
  {
    id: "shark",
    back: 0.38,
    back3q: 0.4,
    face: {
      front: { centerX: 0, centerY: 0.25, radiusX: 0.7, radiusY: 0.62 },
      front3q: { centerX: 0.16, centerY: 0.24, radiusX: 0.66, radiusY: 0.62 },
      side: { centerX: 0.45, centerY: 0.4, radiusX: 0.27, radiusY: 0.43 },
    },
  },
  {
    id: "raincoat",
    back: 0.38,
    back3q: 0.38,
    face: {
      front: { centerX: 0, centerY: 0.27, radiusX: 0.72, radiusY: 0.7 },
      front3q: { centerX: 0.18, centerY: 0.25, radiusX: 0.68, radiusY: 0.68 },
      side: { centerX: 0.45, centerY: 0.44, radiusX: 0.28, radiusY: 0.44 },
    },
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

export function onepieceFaceAperture(id: string, view: WardrobeView, head: FitEllipse, mirror: boolean): FitEllipse | undefined {
  const opening = HOOD_PROFILES.find((profile) => profile.id === id)?.face[view];
  if (!opening) return undefined;
  const [cx, cy, rx, ry] = head;
  const direction = mirror ? -1 : 1;
  return [cx + rx * opening.centerX * direction, cy + ry * opening.centerY, rx * opening.radiusX, ry * opening.radiusY];
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
