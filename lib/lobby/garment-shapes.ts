import type { CharacterFit } from "./character-fit";
import type { GarmentDesign } from "./garment-designs";

type GarmentPose = { readonly fit: CharacterFit; readonly design: GarmentDesign };

export function hoodOpening(fit: CharacterFit) {
  const side = Math.min(1, Math.abs(fit.turn));
  return {
    x: fit.x + Math.sign(fit.turn) * fit.rx * side * 0.48,
    y: fit.y + fit.ry * 0.21,
    rx: fit.rx * (0.91 - side * 0.35),
    ry: fit.ry * 0.78,
    visible: Math.abs(fit.turn) < 1.9,
  };
}

export function drawGarmentSkirt(target: CanvasRenderingContext2D, { fit, design }: GarmentPose) {
  if (design.silhouette === "fitted") return;
  const layer = document.createElement("canvas");
  layer.width = layer.height = 384;
  const ctx = layer.getContext("2d");
  if (!ctx) return;
  ctx.scale(384, 384);
  const [r, g, b] = design.color;
  const center = fit.x - Math.sign(fit.turn) * Math.min(1, Math.abs(fit.turn)) * 0.065;
  const top = fit.neck + (0.89 - fit.neck) * 0.36;
  const bottom = Math.max(top + 0.035, 0.895);
  const side = Math.min(1, Math.abs(fit.turn));
  const width = (design.silhouette === "robe" ? 0.278 : 0.24) - side * 0.055;
  const shoulder = width * 0.7;
  const material = ctx.createLinearGradient(center - width, top, center + width, bottom);
  material.addColorStop(0, `rgb(${r * 1.18} ${g * 1.18} ${b * 1.18})`);
  material.addColorStop(0.48, `rgb(${r} ${g} ${b})`);
  material.addColorStop(1, `rgb(${r * 0.76} ${g * 0.76} ${b * 0.76})`);
  ctx.fillStyle = material;
  ctx.beginPath();
  ctx.moveTo(center - shoulder, top);
  ctx.bezierCurveTo(center - width, top + 0.035, center - width, bottom - 0.075, center - width, bottom - 0.015);
  ctx.quadraticCurveTo(center, bottom + 0.025, center + width, bottom - 0.015);
  ctx.bezierCurveTo(center + width, bottom - 0.075, center + width, top + 0.035, center + shoulder, top);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (const offset of [-0.7, -0.35, 0.2, 0.65]) {
    const x = center + width * offset;
    const fold = ctx.createLinearGradient(x - 0.014, top, x + 0.022, top);
    fold.addColorStop(0, "rgba(255,244,218,0)");
    fold.addColorStop(0.4, "rgba(255,244,218,0.13)");
    fold.addColorStop(0.65, "rgba(35,35,61,0.12)");
    fold.addColorStop(1, "rgba(35,35,61,0)");
    ctx.fillStyle = fold;
    ctx.fillRect(x - 0.014, top, 0.036, bottom - top);
  }
  ctx.fillStyle = "rgba(255,247,222,0.1)";
  for (let y = top; y < bottom; y += 0.007) {
    for (let x = center - width; x < center + width; x += 0.009) {
      ctx.fillRect(x + Math.sin(y * 200) * 0.002, y, 0.0015, 0.001);
    }
  }
  ctx.restore();
  ctx.globalCompositeOperation = "destination-in";
  const blend = ctx.createLinearGradient(0, top, 0, top + 0.07);
  blend.addColorStop(0, "transparent");
  blend.addColorStop(1, "black");
  ctx.fillStyle = blend;
  ctx.fillRect(0, 0, 1, 1);
  if (design.silhouette === "robe" && !fit.raised && fit.neck < 0.7) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = material;
    for (const direction of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(center + direction * shoulder, fit.neck + 0.04);
      ctx.quadraticCurveTo(center + direction * (width + 0.035), fit.neck + 0.04, center + direction * (width + 0.025), fit.neck + 0.17);
      ctx.quadraticCurveTo(center + direction * width, fit.neck + 0.195, center + direction * (shoulder - 0.015), fit.neck + 0.16);
      ctx.closePath();
      ctx.fill();
    }
  }
  target.drawImage(layer, 0, 0, 1, 1);
}

export function drawHoodDetails(ctx: CanvasRenderingContext2D, { fit, design, source }: GarmentPose & { readonly source: HTMLImageElement }) {
  if (design.hood === "none") return;
  let teeth: HTMLCanvasElement | undefined;
  ctx.save();
  ctx.translate(fit.x, fit.y);
  ctx.rotate(fit.tilt);
  const [r, g, b] = design.color;
  const material = ctx.createLinearGradient(-fit.rx, -fit.ry, fit.rx, fit.ry);
  material.addColorStop(0, `rgb(${r * 1.2} ${g * 1.2} ${b * 1.2})`);
  material.addColorStop(1, `rgb(${r * 0.78} ${g * 0.78} ${b * 0.78})`);
  ctx.fillStyle = material;
  ctx.lineJoin = "round";
  ctx.lineWidth = 0.004;
  ctx.strokeStyle = `rgb(${r * 0.72} ${g * 0.72} ${b * 0.72})`;
  const top = -fit.ry * 0.87;
  if (design.hood === "frog") {
    for (const side of [-1, 1]) {
      const x = side * fit.rx * 0.62;
      ctx.fillStyle = material;
      ctx.beginPath();
      ctx.ellipse(x, top, fit.rx * 0.24, fit.ry * 0.29, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (Math.abs(fit.turn) < 1.4) {
        ctx.fillStyle = "#f7efcf";
        ctx.beginPath();
        ctx.ellipse(x + fit.turn * 0.01, top - 0.005, 0.026, 0.028, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#344835";
        ctx.beginPath();
        ctx.ellipse(x + fit.turn * 0.017, top - 0.003, 0.011, 0.014, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    const spikes = design.hood === "dino" ? 3 : 1;
    for (let n = 0; n < spikes; n++) {
      const x = (n - (spikes - 1) / 2) * 0.071;
      ctx.fillStyle = design.hood === "dino" ? "#dbc58a" : material;
      ctx.beginPath();
      ctx.moveTo(x - 0.038, top + 0.025);
      ctx.quadraticCurveTo(x - 0.027, top - 0.025, x + 0.018, top - 0.065);
      ctx.quadraticCurveTo(x + 0.02, top - 0.012, x + 0.044, top + 0.025);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (design.hood === "shark" && Math.abs(fit.turn) < 1.4) {
      teeth = document.createElement("canvas");
      teeth.width = teeth.height = 384;
      const trim = teeth.getContext("2d");
      if (!trim) {
        ctx.restore();
        return;
      }
      trim.scale(384, 384);
      trim.translate(fit.x, fit.y);
      trim.rotate(fit.tilt);
      const face = hoodOpening(fit);
      trim.fillStyle = "#faf1dc";
      for (let n = -2; n <= 2; n++) {
        const x = face.x - fit.x + n * face.rx * 0.3;
        const y = face.y - fit.y - face.ry * Math.sqrt(1 - (n * 0.3) ** 2);
        trim.beginPath();
        trim.moveTo(x - 0.012, y - 0.008);
        trim.lineTo(x, y + 0.014);
        trim.lineTo(x + 0.012, y - 0.008);
        trim.closePath();
        trim.fill();
      }
      trim.setTransform(384, 0, 0, 384, 0, 0);
      trim.globalCompositeOperation = "destination-in";
      trim.drawImage(source, 0, 0, 1, 1);
    }
  }
  ctx.restore();
  if (teeth) ctx.drawImage(teeth, 0, 0, 1, 1);
}
