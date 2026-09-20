import type { CharacterFit } from "./character-fit";
import { GARMENT_DESIGNS } from "./garment-designs";
import { drawGarmentSkirt, drawHoodDetails, hoodOpening } from "./garment-shapes";

export function drawCharacterClothes(ctx: CanvasRenderingContext2D, source: HTMLImageElement, style: { readonly id: string; readonly fit: CharacterFit }) {
  const design = GARMENT_DESIGNS[style.id];
  if (!design) return;
  const color = design.color;
  const { fit, id } = style;
  const size = 384;
  const cloth = document.createElement("canvas");
  cloth.width = cloth.height = size;
  const fabric = cloth.getContext("2d");
  if (!fabric) return;
  fabric.drawImage(source, 0, 0, size, size);
  const pixels = fabric.getImageData(0, 0, size, size);
  const { data } = pixels;
  const cosine = Math.cos(fit.tilt);
  const sine = Math.sin(fit.tilt);
  const seated = frameIsSeated(source.src);
  const center = fit.x + fit.turn * 0.065;
  const width = 0.18 * (1 - Math.min(1, Math.abs(fit.turn)) * 0.4);
  const opening = hoodOpening(fit);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (data[i + 3] === 0) continue;
      const px = x / size;
      const py = y / size;
      const dx = px - fit.x;
      const dy = py - fit.y;
      const hx = dx * cosine + dy * sine;
      const hy = dy * cosine - dx * sine;
      const garmentY = fit.y + hy;
      const head = (hx / (fit.rx * 1.02)) ** 2 + (hy / (fit.ry * 1.04)) ** 2;
      const sleeve = fit.raised && head > 1.08 && py > 0.16 && garmentY < fit.neck;
      const foot = py > (seated ? 0.79 : 0.82) && (Math.abs(fit.turn) > 0.8 || Math.abs(dx) > (seated ? fit.rx * 0.46 : 0.07));
      const pawZone = foot || garmentY < fit.neck + 0.23 || sleeve;
      const hood = design.hood !== "none" && (garmentY < fit.neck || head < 1.05) && !sleeve;
      const face = opening.visible && ((fit.x + hx - opening.x) / opening.rx) ** 2 + ((garmentY - opening.y) / opening.ry) ** 2 < 1;
      if (hood ? face : (garmentY < fit.neck && !sleeve) || head < 1) {
        data[i + 3] = 0;
        continue;
      }
      if (pawZone && (!hood || hy > fit.ry * 0.72)) data[i + 3] *= Math.max(0, Math.min(1, (data[i] - 147) / 50));
      const shade = Math.max(0.42, Math.min(1.3, (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 168));
      const weave = 1 + Math.sin(x * 2.1 + y * 0.7) * 0.016;
      const cotton = id === "overalls" && garmentY < fit.neck + 0.12 && (Math.abs(fit.x + hx - center) > width * 0.66 || garmentY < fit.neck + 0.035);
      const pigment = cotton ? [238, 229, 208] : color;
      for (let channel = 0; channel < 3; channel++) data[i + channel] = Math.min(255, pigment[channel] * shade * weave);
    }
  }
  fabric.putImageData(pixels, 0, 0);
  fabric.scale(size, size);
  fabric.translate(fit.x, fit.y);
  fabric.rotate(fit.tilt);
  fabric.translate(-fit.x, -fit.y);
  fabric.globalCompositeOperation = design.silhouette === "coat" ? "destination-over" : "source-over";
  drawGarmentSkirt(fabric, { fit, design });
  fabric.globalCompositeOperation = "source-atop";
  fabric.lineCap = "round";
  fabric.lineJoin = "round";
  const waist = fit.neck + (0.88 - fit.neck) * 0.58;
  const front = Math.abs(fit.turn) < 1.4;
  const line = (points: readonly (readonly [number, number])[], ink: string, weight: number) => {
    fabric.beginPath();
    points.forEach(([x, y], n) => n === 0 ? fabric.moveTo(x, y) : fabric.lineTo(x, y));
    fabric.strokeStyle = ink;
    fabric.lineWidth = weight;
    fabric.stroke();
  };
  const dot = (x: number, y: number, ink: string, radius = 0.009) => {
    fabric.fillStyle = ink;
    fabric.beginPath();
    fabric.ellipse(x, y, radius, radius * 1.15, 0, 0, Math.PI * 2);
    fabric.fill();
  };
  switch (id) {
    case "overalls":
      for (const side of [-1, 1]) {
        line([[center + side * width * 0.7, fit.neck - 0.02], [center + side * width * 0.62, waist]], "#446b96", 0.038);
        line([[center + side * width * 0.7, fit.neck - 0.02], [center + side * width * 0.62, waist]], "#99b7ce", 0.004);
        dot(center + side * width * 0.62, fit.neck + 0.145, "#dfbd70");
      }
      if (front) line([[center - width * 0.36, waist - 0.04], [center - width * 0.3, waist + 0.045], [center, waist + 0.065], [center + width * 0.3, waist + 0.045], [center + width * 0.36, waist - 0.04]], "#b8c9d3", 0.004);
      break;
    case "yukata":
      if (front) {
        line([[center - width, fit.neck], [center + width * 0.38, waist]], "#e8ddc9", 0.021);
        line([[center + width, fit.neck], [center - width * 0.5, waist]], "#d5c9b8", 0.019);
      }
      line([[0.12, waist], [0.88, waist]], "#d6acac", 0.054);
      line([[0.12, waist + 0.008], [0.88, waist + 0.008]], "#f2d4c3", 0.005);
      for (let n = 0; n < 6; n++) {
        const x = 0.27 + n % 3 * 0.16;
        const y = waist + 0.055 + Math.floor(n / 3) * 0.07;
        for (const angle of [0, 1.26, 2.51, 3.77, 5.03]) dot(x + Math.cos(angle) * 0.012, y + Math.sin(angle) * 0.012, "#d9dce9", 0.007);
        dot(x, y, "#e7c697", 0.004);
      }
      if (!front) {
        for (const side of [-1, 1]) {
          fabric.fillStyle = "#d6acac";
          fabric.beginPath();
          fabric.ellipse(fit.x + side * 0.048, waist, 0.06, 0.037, side * 0.35, 0, Math.PI * 2);
          fabric.fill();
        }
        line([[fit.x, waist - 0.025], [fit.x, waist + 0.025]], "#eed0bb", 0.025);
      }
      break;
    case "strawberry":
      for (let n = 0; n < 30; n++) dot(0.18 + n % 6 * 0.13, fit.neck + 0.04 + Math.floor(n / 6) * 0.075, "#f2d88d", 0.005);
      line([[center - width, fit.neck], [center - width * 0.45, fit.neck + 0.04], [center, fit.neck + 0.015], [center + width * 0.45, fit.neck + 0.04], [center + width, fit.neck]], "#669751", 0.032);
      break;
    case "raincoat":
      if (front) {
        line([[center, fit.neck], [center, 0.88]], "#bc913a", 0.006);
        for (const y of [fit.neck + 0.06, waist, waist + 0.09]) dot(center + 0.018, y, "#a18644", 0.006);
        for (const side of [-1, 1]) line([[center + side * width * 0.45, waist + 0.01], [center + side * width * 0.85, waist - 0.015]], "#f8dda0", 0.015);
      }
      break;
    case "dino":
    case "shark":
      if (front) {
        fabric.fillStyle = id === "dino" ? "#cbd99b" : "#e8ece6";
        fabric.globalAlpha = 0.7;
        fabric.beginPath();
        fabric.ellipse(center, waist + 0.015, width * 0.63, (0.88 - fit.neck) * 0.42, 0, 0, Math.PI * 2);
        fabric.fill();
        fabric.globalAlpha = 1;
        line([[center, fit.neck], [center, 0.87]], id === "dino" ? "#799764" : "#8ba1ac", 0.003);
      } else {
        for (let n = 0; n < 4; n++) dot(center, fit.neck + 0.06 + n * 0.065, id === "dino" ? "#d0db9d" : "#b8cbd4", 0.017);
      }
      break;
  }
  ctx.drawImage(cloth, 0, 0, 1, 1);
  drawHoodDetails(ctx, { fit, design, source });
}

function frameIsSeated(src: string) {
  return /capybara-(idle|sleep|pick-1)/.test(src);
}
