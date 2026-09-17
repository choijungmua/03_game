import { dressSprite, type FacePatch, type Outfit, type OutfitPiece, spriteName } from "@/lib/lobby/wardrobe";

type OutfitCanvasFrame = {
  readonly ctx: CanvasRenderingContext2D;
  readonly base: HTMLImageElement;
  readonly outfit: Outfit;
  readonly left: number;
  readonly top: number;
  readonly size: number;
  readonly imageFor: (src: string) => HTMLImageElement;
};

/**
 * 스프라이트만 그린 캔버스(left, top, 정사각형 size) 위에 옷을 전부 입힌다 (자리는 lib/lobby/wardrobe.ts dressSprite).
 * 채움층은 source-atop, 옷 윤곽 밖 지우기는 destination-in이라 다른 그림이 깔린 캔버스에서는 쓰면 안 된다
 */
export function drawOutfit({ ctx, base, outfit, left, top, size, imageFor }: OutfitCanvasFrame) {
  const { silhouette, under, face, redraw, over } = dressSprite(spriteName(base.src), outfit);
  const drawPiece = (ctx: CanvasRenderingContext2D, piece: OutfitPiece) => {
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
  const put = (piece: OutfitPiece) => drawPiece(ctx, piece);

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
  if (silhouette.length) {
    // 옷보다 넓은 몸은 옷 윤곽 밖으로 삐져나와 채움층 색이 번져 보인다 — 옷 윤곽 밖을 지운다. 얼굴·발·모자는 뒤에 다시 그린다
    const outline = document.createElement("canvas");
    outline.width = ctx.canvas.width;
    outline.height = ctx.canvas.height;
    const outlineCtx = outline.getContext("2d");
    if (outlineCtx) {
      silhouette.forEach((piece) => drawPiece(outlineCtx, piece));
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top, size, size);
      ctx.clip();
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(outline, 0, 0);
      ctx.restore();
    }
  }
  face.forEach(putFace);
  redraw.forEach(putBase);
  over.forEach(put);
}
