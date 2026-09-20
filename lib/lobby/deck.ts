import type { Tile } from "./world";

export type DeckTextureMode = "connector" | "horizontal" | "vertical";

export function deckTextureMode(tileAt: (tx: number, ty: number) => Tile, tx: number, ty: number): DeckTextureMode {
  const left = tileAt(tx - 1, ty) === "deck";
  const right = tileAt(tx + 1, ty) === "deck";
  const up = tileAt(tx, ty - 1) === "deck";
  const down = tileAt(tx, ty + 1) === "deck";
  const horizontalNeighbor = left || right;
  const verticalNeighbor = up || down;

  if (horizontalNeighbor && !verticalNeighbor) return "horizontal";
  if (verticalNeighbor && !horizontalNeighbor) return "vertical";

  const runLength = (dx: number, dy: number) => {
    let length = 1;
    for (const direction of [-1, 1]) {
      for (let distance = 1; distance <= 12; distance += 1) {
        if (tileAt(tx + dx * distance * direction, ty + dy * distance * direction) !== "deck") break;
        length += 1;
      }
    }
    return length;
  };
  const horizontal = runLength(1, 0);
  const vertical = runLength(0, 1);

  if (horizontal > vertical) return "horizontal";
  if (vertical > horizontal) return "vertical";
  return "connector";
}
