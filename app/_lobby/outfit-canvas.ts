import { dressSprite, type FacePatch, type Outfit, type OutfitPiece, spriteName } from "@/lib/lobby/wardrobe";

export type OutfitDrawer = {
  readonly dressed: (base: HTMLImageElement, outfit: Outfit, size: number) => HTMLCanvasElement | null;
};

type OutfitCanvasFrame = {
  readonly ctx: CanvasRenderingContext2D;
  readonly base: HTMLImageElement;
  readonly outfit: Outfit;
  readonly left: number;
  readonly top: number;
  readonly size: number;
  readonly imageFor: (src: string) => HTMLImageElement;
};

export function drawOutfit({ ctx, base, outfit, left, top, size, imageFor }: OutfitCanvasFrame) {
  const { silhouette, under, face, redraw, over } = dressSprite(spriteName(base.src), outfit);
  const put = (piece: OutfitPiece) => {
    const item = imageFor(piece.src);
    if (!item.complete || item.naturalWidth === 0) return;
    const [cropLeft, cropTop, cropWidth, cropHeight] = piece.crop ?? [0, 0, 1, 1];
    const sourceX = item.naturalWidth * cropLeft;
    const sourceY = item.naturalHeight * cropTop;
    const sourceWidth = item.naturalWidth * cropWidth;
    const sourceHeight = item.naturalHeight * cropHeight;
    const x = left + (size * piece.left) / 100;
    const y = top + (size * piece.top) / 100;
    const width = (size * piece.width) / 100;
    const height = (size * piece.height) / 100;
    if (!piece.mirror) {
      ctx.drawImage(item, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
      return;
    }
    ctx.save();
    ctx.translate(x + width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(item, sourceX, sourceY, sourceWidth, sourceHeight, 0, y, width, height);
    ctx.restore();
  };

  const putBase = ([cx, cy, rx, ry]: readonly [number, number, number, number]) => {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(left + (size * cx) / 100, top + (size * cy) / 100, (size * rx) / 100, (size * ry) / 100, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(base, left, top, size, size);
    ctx.restore();
  };

  const putFace = ({ source: [sourceX, sourceY, sourceRx, sourceRy], clip: [cx, cy, rx, ry] }: FacePatch) => {
    const scaleX = rx / sourceRx;
    const scaleY = ry / sourceRy;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(left + (size * cx) / 100, top + (size * cy) / 100, (size * rx) / 100, (size * ry) / 100, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      base,
      left + (size * (cx - sourceX * scaleX)) / 100,
      top + (size * (cy - sourceY * scaleY)) / 100,
      size * scaleX,
      size * scaleY,
    );
    ctx.restore();
  };

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  under.forEach(put);
  ctx.restore();
  silhouette.forEach(put);
  face.forEach(putFace);
  redraw.forEach(putBase);
  over.forEach(put);
}
