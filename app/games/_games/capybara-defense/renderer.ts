import { DEFENSE_ATLASES, DEFENSE_FRAMES } from "./assets";
import type { DefenseFrame, DefenseFrameId } from "./assets";
import type { HeroClass, MapId } from "./types";

export type DefenseRenderUnit = Readonly<{
  heroClass: HeroClass;
  slot: number;
  selected: boolean;
  position?: readonly [x: number, y: number];
}>;

export type DefenseRenderMonster = Readonly<{
  progress: number;
  health: number;
  maxHealth: number;
  boss: boolean;
}>;

export type DefenseRenderModel = Readonly<{
  mapId: MapId;
  round: number;
  monsters: readonly DefenseRenderMonster[];
  units: readonly DefenseRenderUnit[];
  damageNumbers: boolean;
  screenShake: boolean;
  reducedMotion: boolean;
  targeting: boolean;
  attackEffects?: readonly Readonly<{ heroClass: HeroClass; position: readonly [x: number, y: number] }>[];
}>;

export type UnitPlacementPoint = Readonly<{ x: number; y: number }>;
export type UnitPlacementResult =
  | Readonly<{ kind: "valid" }>
  | Readonly<{ kind: "invalid"; reason: "경기장 밖에는 놓을 수 없습니다." | "몬스터 길에는 놓을 수 없습니다." | "다른 영웅과 겹칩니다." }>;

const CLASS_EFFECT_FRAMES: Readonly<Record<HeroClass, DefenseFrameId>> = {
  warrior: "skill.ground-thump",
  archer: "projectile.leaf-dart",
  rogue: "skill.acorn-barrage",
  mage: "projectile.water-drop",
};

export function getClassAttackPresentation(heroClass: HeroClass): Readonly<{ cue: string; timingMs: number; frameId: DefenseFrameId }> {
  const presentations: Readonly<Record<HeroClass, Readonly<{ cue: string; timingMs: number }>>> = {
    warrior: { cue: "전사 근접 휘두르기", timingMs: 360 },
    archer: { cue: "궁수 화살 발사", timingMs: 520 },
    rogue: { cue: "도적 표창 튕기기", timingMs: 280 },
    mage: { cue: "마법사 범위 마법탄", timingMs: 640 },
  };
  return { ...presentations[heroClass], frameId: CLASS_EFFECT_FRAMES[heroClass] };
}

export function getClassEffectFrame(heroClass: HeroClass): DefenseFrame {
  const frameId = CLASS_EFFECT_FRAMES[heroClass];
  const frame = DEFENSE_FRAMES.find((candidate) => candidate.id === frameId);
  if (frame === undefined) throw new Error(`Missing defense effect frame: ${frameId}`);
  return frame;
}

export function validateUnitPlacement(point: UnitPlacementPoint, occupied: readonly UnitPlacementPoint[]): UnitPlacementResult {
  if (point.x < 0.06 || point.x > 0.94 || point.y < 0.06 || point.y > 0.94) return { kind: "invalid", reason: "경기장 밖에는 놓을 수 없습니다." };
  const onHorizontalPath = point.x >= LOOP_BOUNDS.left && point.x <= LOOP_BOUNDS.right
    && (Math.abs(point.y - LOOP_BOUNDS.top) < 0.085 || Math.abs(point.y - LOOP_BOUNDS.bottom) < 0.085);
  const onVerticalPath = point.y >= LOOP_BOUNDS.top && point.y <= LOOP_BOUNDS.bottom
    && (Math.abs(point.x - LOOP_BOUNDS.left) < 0.085 || Math.abs(point.x - LOOP_BOUNDS.right) < 0.085);
  if (onHorizontalPath || onVerticalPath) return { kind: "invalid", reason: "몬스터 길에는 놓을 수 없습니다." };
  if (occupied.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < 0.12)) return { kind: "invalid", reason: "다른 영웅과 겹칩니다." };
  return { kind: "valid" };
}

const images = new Map<string, HTMLImageElement>();
const MAP_COLUMN: Readonly<Record<MapId, number>> = {
  "reed-marsh": 0,
  "hot-spring": 1,
  "moonlit-orchard": 2,
};
const CLASS_COLUMN: Readonly<Record<HeroClass, number>> = {
  warrior: 0,
  archer: 1,
  rogue: 2,
  mage: 3,
};

export const DEFENSE_ARENA_WIDTH = 768;
export const DEFENSE_ARENA_HEIGHT = 512;
const LOOP_BOUNDS = Object.freeze({ left: 3 / 16, top: 3 / 16, right: 13 / 16, bottom: 13 / 16 });
const UNIT_SLOTS = [
  [5 / 16, 5 / 16], [7 / 16, 5 / 16], [9 / 16, 5 / 16], [11 / 16, 5 / 16],
  [5 / 16, 11 / 16], [7 / 16, 11 / 16], [9 / 16, 11 / 16], [11 / 16, 11 / 16],
] as const;

export function getUnitRenderPoint(slot: number): readonly [x: number, y: number] {
  return UNIT_SLOTS[slot % UNIT_SLOTS.length] ?? [0.5, 0.5];
}

type RenderPoint = readonly [x: number, y: number];

const MAP_PATHS: Readonly<Record<MapId, readonly RenderPoint[]>> = {
  "reed-marsh": [
    [0.5, -0.02], [0.5, 0.1], [0.72, 0.16], [0.75, 0.23], [0.62, 0.29],
    [0.43, 0.34], [0.35, 0.4], [0.46, 0.46], [0.64, 0.51], [0.68, 0.58],
    [0.55, 0.64], [0.36, 0.68], [0.29, 0.74], [0.36, 0.8], [0.52, 0.86], [0.54, 1.02],
  ],
  "hot-spring": [
    [0.48, -0.02], [0.5, 0.1], [0.68, 0.18], [0.69, 0.29], [0.55, 0.35],
    [0.3, 0.4], [0.23, 0.5], [0.37, 0.56], [0.67, 0.62], [0.66, 0.73],
    [0.48, 0.82], [0.45, 0.91], [0.53, 1.02],
  ],
  "moonlit-orchard": [
    [0.39, -0.02], [0.42, 0.14], [0.62, 0.22], [0.76, 0.34], [0.79, 0.47],
    [0.66, 0.57], [0.42, 0.59], [0.24, 0.52], [0.2, 0.4], [0.29, 0.3],
    [0.47, 0.29], [0.51, 0.43], [0.49, 0.62], [0.5, 0.82], [0.5, 1.02],
  ],
};

export function getMonsterRenderPoint(mapId: MapId, progress: number): RenderPoint {
  void mapId;
  const normalized = ((progress % 1) + 1) % 1;
  const side = normalized * 4;
  const offset = side % 1;
  if (side < 1) return [LOOP_BOUNDS.left + (LOOP_BOUNDS.right - LOOP_BOUNDS.left) * offset, LOOP_BOUNDS.top];
  if (side < 2) return [LOOP_BOUNDS.right, LOOP_BOUNDS.top + (LOOP_BOUNDS.bottom - LOOP_BOUNDS.top) * offset];
  if (side < 3) return [LOOP_BOUNDS.right - (LOOP_BOUNDS.right - LOOP_BOUNDS.left) * offset, LOOP_BOUNDS.bottom];
  return [LOOP_BOUNDS.left, LOOP_BOUNDS.bottom - (LOOP_BOUNDS.bottom - LOOP_BOUNDS.top) * offset];
}

export function getLegacyMonsterRenderPoint(mapId: MapId, progress: number): RenderPoint {
  const path = MAP_PATHS[mapId];
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const segmentLengths = path.slice(1).map((point, index) => {
    const previous = path[index];
    if (previous === undefined) return 0;
    return Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  });
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  let remaining = clampedProgress * totalLength;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const length = segmentLengths[index] ?? 0;
    const from = path[index];
    const to = path[index + 1];
    if (from === undefined || to === undefined) continue;
    if (remaining <= length || index === segmentLengths.length - 1) {
      const ratio = length === 0 ? 0 : remaining / length;
      return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
    }
    remaining -= length;
  }

  return path.at(-1) ?? [0.5, 0.5];
}

function getImage(src: string, redraw: () => void): HTMLImageElement | null {
  const cached = images.get(src);
  if (cached !== undefined) return cached.complete ? cached : null;
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  image.addEventListener("load", redraw, { once: true });
  images.set(src, image);
  return null;
}

function drawMapCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  mapId: MapId,
  width: number,
  height: number,
): void {
  const sourceWidth = 512;
  const sourceHeight = 768;
  const targetRatio = width / height;
  const cropWidth = Math.min(sourceWidth, sourceHeight * targetRatio);
  const cropHeight = Math.min(sourceHeight, sourceWidth / targetRatio);
  const sourceX = MAP_COLUMN[mapId] * sourceWidth + (sourceWidth - cropWidth) / 2;
  const sourceY = (sourceHeight - cropHeight) / 2;
  context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, width, height);
}

function drawClosedLoop(context: CanvasRenderingContext2D, width: number, height: number): void {
  const left = LOOP_BOUNDS.left * width;
  const top = LOOP_BOUNDS.top * height;
  const loopWidth = (LOOP_BOUNDS.right - LOOP_BOUNDS.left) * width;
  const loopHeight = (LOOP_BOUNDS.bottom - LOOP_BOUNDS.top) * height;
  context.lineJoin = "round";
  context.strokeStyle = "rgba(45, 29, 19, .5)";
  context.lineWidth = Math.min(width, height) * 0.115;
  context.strokeRect(left, top, loopWidth, loopHeight);
  context.strokeStyle = "rgba(190, 142, 82, .96)";
  context.lineWidth = Math.min(width, height) * 0.09;
  context.strokeRect(left, top, loopWidth, loopHeight);
  context.strokeStyle = "rgba(255, 231, 169, .45)";
  context.lineWidth = 2;
  context.setLineDash([8, 7]);
  context.strokeRect(left, top, loopWidth, loopHeight);
  context.setLineDash([]);
}

function fitCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

function drawUnit(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  unit: DefenseRenderUnit,
  width: number,
  height: number,
): void {
  const point = unit.position ?? getUnitRenderPoint(unit.slot);
  const size = Math.min(width, height) * 0.14;
  const x = point[0] * width - size / 2;
  const y = point[1] * height - size * 0.58;
  if (unit.selected) {
    context.strokeStyle = "rgba(255, 244, 193, .92)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x + size / 2, y + size * 0.8, size * 0.54, 0, Math.PI * 2);
    context.stroke();
  }
  context.drawImage(image, CLASS_COLUMN[unit.heroClass] * 128, 0, 128, 256, x, y, size, size * 1.3);
}

function drawMonster(
  context: CanvasRenderingContext2D,
  monsterImage: HTMLImageElement,
  bossImage: HTMLImageElement | null,
  monster: DefenseRenderMonster,
  index: number,
  round: number,
  mapId: MapId,
  width: number,
  height: number,
  damageNumbers: boolean,
): void {
  const [x, y] = getMonsterRenderPoint(mapId, monster.progress);
  const size = Math.max(24, Math.min(width, height) * (monster.boss ? 0.18 : 0.075));
  const body = round % 10;
  if (monster.boss && bossImage !== null) {
    const boss = Math.max(0, Math.min(9, Math.floor(round / 10) - 1));
    context.drawImage(bossImage, (boss % 5) * 200, Math.floor(boss / 5) * 250, 200, 250, x * width - size / 2, y * height - size * 0.62, size, size * 1.25);
  } else {
    context.drawImage(monsterImage, (body % 5) * 240, Math.floor(body / 5) * 200, 240, 200, x * width - size / 2, y * height - size / 2, size, size);
  }
  context.fillStyle = "rgba(31, 20, 15, .72)";
  context.fillRect(x * width - size / 2, y * height - size * 0.62, size, 4);
  context.fillStyle = index % 5 === 0 ? "#7dd3fc" : "#f5d48a";
  const healthRatio = monster.maxHealth <= 0 ? 0 : Math.max(0, Math.min(1, monster.health / monster.maxHealth));
  context.fillRect(x * width - size / 2, y * height - size * 0.62, size * healthRatio, 4);
  if (damageNumbers && index < 4) {
    context.fillStyle = "#fff8de";
    context.font = "700 12px system-ui";
    context.fillText(`${18 + index * 7}`, x * width, y * height - size * 0.72);
  }
}

function drawAttackEffect(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  effect: Readonly<{ heroClass: HeroClass; position: readonly [x: number, y: number] }>,
  width: number,
  height: number,
): void {
  const frame = getClassEffectFrame(effect.heroClass);
  const size = Math.min(width, height) * 0.1;
  context.drawImage(image, frame.x, frame.y, frame.width, frame.height, effect.position[0] * width - size / 2, effect.position[1] * height - size / 2, size, size);
}

export function renderDefenseFrame(canvas: HTMLCanvasElement, model: DefenseRenderModel): void {
  const context = fitCanvas(canvas);
  if (context === null) return;
  const width = canvas.getBoundingClientRect().width;
  const height = canvas.getBoundingClientRect().height;
  const redraw = () => renderDefenseFrame(canvas, model);
  const maps = getImage(DEFENSE_ATLASES.maps.src, redraw);
  const units = getImage(DEFENSE_ATLASES.units.src, redraw);
  const monsters = getImage(DEFENSE_ATLASES.monsters.src, redraw);
  const bosses = getImage(DEFENSE_ATLASES.bosses.src, redraw);
  context.clearRect(0, 0, width, height);
  if (model.screenShake && !model.reducedMotion && model.monsters.length >= 120) context.translate(1, -1);
  context.fillStyle = "#314a39";
  context.fillRect(0, 0, width, height);
  if (maps !== null) {
    drawMapCover(context, maps, model.mapId, width, height);
  }
  drawClosedLoop(context, width, height);
  if (units !== null) {
    for (const unit of model.units) drawUnit(context, units, unit, width, height);
    for (const effect of model.attackEffects ?? []) drawAttackEffect(context, units, effect, width, height);
  }
  if (monsters !== null) {
    const visibleCount = Math.min(model.monsters.length, model.reducedMotion ? 18 : 28);
    for (let index = 0; index < visibleCount; index += 1) {
      const sourceIndex = visibleCount <= 1 ? 0 : Math.floor(index * (model.monsters.length - 1) / (visibleCount - 1));
      const monster = model.monsters[sourceIndex];
      if (monster !== undefined) drawMonster(context, monsters, bosses, monster, index, model.round, model.mapId, width, height, model.damageNumbers);
    }
  }
  if (model.targeting) {
    context.strokeStyle = "rgba(255, 245, 191, .9)";
    context.lineWidth = 3;
    context.setLineDash([8, 8]);
    context.beginPath();
    context.arc(width / 2, height / 2, Math.min(width, height) * 0.16, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }
}
