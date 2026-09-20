import type { CharacterFit } from "./character-fit";

const FRAMES: Readonly<Record<string, string>> = {
  wood: "#875b39", sunglasses: "#34302c", heart: "#d76c91", star: "#ddb950", rainbow: "#d787a4", goggles: "#57a996",
};

export function drawCharacterGlasses(ctx: CanvasRenderingContext2D, style: { readonly id: string; readonly fit: CharacterFit }) {
  const { id, fit } = style;
  const ink = FRAMES[id];
  if (!ink) return;
  ctx.save();
  ctx.translate(fit.x, fit.y);
  ctx.rotate(fit.tilt);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.009;
  ctx.lineCap = "round";
  const turn = Math.abs(fit.turn);
  const sign = Math.sign(fit.turn);
  const eyeY = fit.eyeY === undefined ? -fit.ry * 0.1 : fit.eyeY - fit.y;
  if (turn >= 1.4 && !fit.eyes) {
    if (turn < 2) {
      ctx.beginPath();
      ctx.moveTo(sign * fit.rx * 0.35, eyeY - 0.025);
      ctx.quadraticCurveTo(sign * fit.rx * 0.7, eyeY - 0.016, sign * fit.rx * 0.94, eyeY + 0.012);
      ctx.stroke();
    }
    if (id === "goggles") {
      ctx.beginPath();
      ctx.ellipse(0, eyeY, fit.rx * 0.92, fit.ry * 0.18, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  const centers = fit.eyes?.map((eye) => eye - fit.x) ?? (turn > 0.8 ? [sign * fit.rx * 0.29] : [-fit.rx * 0.55 + fit.turn * (sign > 0 ? 0.16 : 0.055), fit.rx * 0.55 + fit.turn * (sign > 0 ? 0.055 : 0.16)]);
  const radius = fit.rx * 0.285;
  if (centers.length === 2) {
    ctx.beginPath();
    ctx.moveTo(centers[0] + radius * 0.87, eyeY - radius * 0.08);
    ctx.quadraticCurveTo((centers[0] + centers[1]) / 2, eyeY - radius * 0.37, centers[1] - radius * 0.87, eyeY - radius * 0.08);
    ctx.stroke();
  }
  for (const x of centers) {
    const far = turn > 0.2 && Math.sign(x) === sign;
    ctx.save();
    ctx.translate(x, eyeY);
    ctx.scale(turn > 1.4 ? 0.35 : turn > 0.8 ? 0.65 : far ? 0.75 : 1, 1);
    ctx.beginPath();
    switch (id) {
      case "heart":
        ctx.moveTo(0, radius * 0.85);
        ctx.bezierCurveTo(-radius * 1.7, -radius * 0.15, -radius * 0.75, -radius * 1.45, 0, -radius * 0.6);
        ctx.bezierCurveTo(radius * 0.75, -radius * 1.45, radius * 1.7, -radius * 0.15, 0, radius * 0.85);
        break;
      case "star":
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const r = radius * (i % 2 ? 0.52 : 1.15);
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        break;
      case "sunglasses":
        ctx.roundRect(-radius * 1.04, -radius * 0.75, radius * 2.08, radius * 1.5, radius * 0.3);
        break;
      default:
        ctx.ellipse(0, 0, radius, radius * (id === "goggles" ? 0.82 : 1), 0, 0, Math.PI * 2);
    }
    const lens = ctx.createLinearGradient(0, -radius, 0, radius);
    const dark = id === "sunglasses" || id === "star";
    lens.addColorStop(0, dark ? "rgba(45,54,56,0.94)" : "rgba(232,249,251,0.24)");
    lens.addColorStop(1, dark ? "rgba(36,32,28,0.88)" : "rgba(159,209,215,0.05)");
    ctx.fillStyle = lens;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = id === "goggles" ? 0.014 : 0.009;
    ctx.stroke();
    if (id === "rainbow") {
      ["#df847c", "#e8c975", "#80af8b", "#80b4cc"].forEach((color, index) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.005;
        ctx.arc(0, 0, radius + 0.002, index * Math.PI / 2, (index + 1) * Math.PI / 2);
        ctx.stroke();
      });
    }
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 0.004;
    ctx.moveTo(-radius * 0.45, -radius * 0.42);
    ctx.lineTo(-radius * 0.08, -radius * 0.65);
    ctx.stroke();
    ctx.restore();
  }
  if (turn > 0.25) {
    ctx.strokeStyle = ink;
    ctx.beginPath();
    const x = sign > 0 ? centers[0] : centers[centers.length - 1];
    ctx.moveTo(x - sign * radius * 0.8, eyeY - 0.004);
    ctx.lineTo(-sign * fit.rx * 0.66, eyeY - 0.025);
    ctx.stroke();
  }
  ctx.restore();
}

const HAT_CROPS = new Map<string, readonly [number, number, number, number]>();

export function drawCharacterHat(ctx: CanvasRenderingContext2D, image: HTMLImageElement, placement: { readonly cell: readonly [number, number, number]; readonly id: string; readonly fit: CharacterFit }) {
  const { cell: [sx, sy, cell], id, fit } = placement;
  const key = `${image.src}:${sx}:${sy}`;
  let bounds = HAT_CROPS.get(key);
  if (!bounds) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = cell;
    const scan = canvas.getContext("2d");
    if (!scan) return;
    scan.drawImage(image, sx, sy, cell, cell, 0, 0, cell, cell);
    const { data } = scan.getImageData(0, 0, cell, cell);
    let left = cell, top = cell, right = 0, bottom = 0;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      if (data[(y * cell + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    if (right <= left || bottom <= top) return;
    bounds = [left, top, right - left + 1, bottom - top + 1];
    HAT_CROPS.set(key, bounds);
  }
  const [left, top, width, height] = bounds;
  const bottom = -fit.ry * 0.78;
  const w = Math.min(fit.rx * (id === "straw" ? 2.25 : id === "crown" ? 0.9 : 1.12), Math.max(0.06, fit.y + bottom - 0.018) * width / height);
  const h = w * height / width;
  ctx.save();
  ctx.translate(fit.x, fit.y);
  ctx.rotate(fit.tilt);
  ctx.drawImage(image, sx + left, sy + top, width, height, -w / 2, bottom - h, w, h);
  ctx.restore();
}
