import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

export async function cleanAlpha(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 192) data[index] = 0;
  }
  let removedPixels;
  do {
    removedPixels = 0;
    const alpha = Uint8Array.from(
      { length: info.width * info.height },
      (_, pixel) => data[pixel * 4 + 3] ?? 0,
    );
    for (let pixel = 0; pixel < alpha.length; pixel += 1) {
      if (alpha[pixel] === 0) continue;
      const red = data[pixel * 4] ?? 0;
      const green = data[pixel * 4 + 1] ?? 0;
      const blue = data[pixel * 4 + 2] ?? 0;
      const chromaticMatte =
        (red > 190 && green < 100 && blue < 100) ||
        (red > 210 && green > 180 && blue < 90) ||
        (green > 170 && red < 100 && blue < 120) ||
        (blue > 170 && green > 130 && red < 100);
      if (!chromaticMatte) continue;
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      let touchesTransparency = false;
      for (let offsetY = -2; offsetY <= 2 && !touchesTransparency; offsetY += 1) {
        for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= info.width || nextY < 0 || nextY >= info.height) continue;
          if ((alpha[nextY * info.width + nextX] ?? 0) === 0) {
            touchesTransparency = true;
            break;
          }
        }
      }
      if (touchesTransparency) {
        data[pixel * 4 + 3] = 0;
        removedPixels += 1;
      }
    }
  } while (removedPixels > 0);
  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) > 0) continue;
    data[index] = 0;
    data[index + 1] = 0;
    data[index + 2] = 0;
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function keepSignificantComponents(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const visited = new Uint8Array(info.width * info.height);
  const components = [];
  for (let start = 0; start < visited.length; start += 1) {
    if (visited[start] || (data[start * 4 + 3] ?? 0) === 0) continue;
    const stack = [start];
    const pixels = [];
    visited[start] = 1;
    while (stack.length > 0) {
      const pixel = stack.pop();
      if (pixel === undefined) continue;
      pixels.push(pixel);
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      for (const neighbor of [pixel - 1, pixel + 1, pixel - info.width, pixel + info.width]) {
        if (
          neighbor < 0 ||
          neighbor >= visited.length ||
          visited[neighbor] ||
          (neighbor === pixel - 1 && x === 0) ||
          (neighbor === pixel + 1 && x === info.width - 1) ||
          (neighbor === pixel - info.width && y === 0) ||
          (neighbor === pixel + info.width && y === info.height - 1) ||
          (data[neighbor * 4 + 3] ?? 0) === 0
        ) {
          continue;
        }
        visited[neighbor] = 1;
        stack.push(neighbor);
      }
    }
    components.push(pixels);
  }
  const largest = Math.max(0, ...components.map(({ length }) => length));
  for (const component of components) {
    if (component.length >= largest * 0.12) continue;
    for (const pixel of component) data[pixel * 4 + 3] = 0;
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

export async function splitGrid(input, { columns, rowStops, width, height, padding }) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = rowStops.length - 1;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const composites = [];
  for (let row = 0; row < rows; row += 1) {
    const top = Math.round((rowStops[row] ?? 0) * info.height);
    const bottom = Math.round((rowStops[row + 1] ?? 1) * info.height);
    const columnCounts = Array.from({ length: info.width }, (_, x) => {
      let count = 0;
      for (let y = top; y < bottom; y += 1) if ((data[(y * info.width + x) * 4 + 3] ?? 0) > 0) count += 1;
      return count;
    });
    const sourceCellWidth = info.width / columns;
    const boundaries = [0];
    for (let column = 1; column < columns; column += 1) {
      const target = Math.round(column * sourceCellWidth);
      const radius = Math.floor(sourceCellWidth * 0.42);
      let boundary = target;
      for (let candidate = target - radius; candidate <= target + radius; candidate += 1) {
        const candidateCount = columnCounts[candidate] ?? Number.POSITIVE_INFINITY;
        const boundaryCount = columnCounts[boundary] ?? Number.POSITIVE_INFINITY;
        if (
          candidateCount < boundaryCount ||
          (candidateCount === boundaryCount && Math.abs(candidate - target) < Math.abs(boundary - target))
        ) {
          boundary = candidate;
        }
      }
      boundaries.push(boundary);
    }
    boundaries.push(info.width);
    for (let column = 0; column < columns; column += 1) {
      const left = boundaries[column] ?? Math.round(column * sourceCellWidth);
      const right = boundaries[column + 1] ?? Math.round((column + 1) * sourceCellWidth);
      const fitted = await sharp(input)
        .extract({ left, top, width: right - left, height: bottom - top })
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .resize(cellWidth - padding * 2, cellHeight - padding * 2, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      const frame = await keepSignificantComponents(fitted);
      composites.push({ input: frame, left: column * cellWidth + padding, top: row * cellHeight + padding });
    }
  }
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toBuffer();
}
