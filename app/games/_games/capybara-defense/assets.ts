export const DEFENSE_ATLASES = {
  units: {
    src: "/assets/images/games/capybara-defense/units-ui.webp",
    width: 1024,
    height: 1024,
    maxBytes: 400_000,
    alpha: true,
  },
  monsters: {
    src: "/assets/images/games/capybara-defense/monster-parts.webp",
    width: 1200,
    height: 1200,
    maxBytes: 600_000,
    alpha: true,
  },
  bosses: {
    src: "/assets/images/games/capybara-defense/bosses.webp",
    width: 1000,
    height: 500,
    maxBytes: 500_000,
    alpha: true,
  },
  maps: {
    src: "/assets/images/games/capybara-defense/maps.webp",
    width: 1536,
    height: 1024,
    maxBytes: 900_000,
    alpha: true,
  },
} as const;

const CLASS_FRAME_IDS = ["class.scout", "class.guardian", "class.healer", "class.engineer"] as const;
const EQUIPMENT_FRAME_IDS = [
  "equipment.helmet",
  "equipment.vest",
  "equipment.boots",
  "equipment.charm",
] as const;
const TIER_FRAME_IDS = ["tier.1", "tier.2", "tier.3", "tier.4", "tier.5", "tier.6"] as const;
const DROP_FRAME_IDS = ["drop.acorn-pouch", "drop.golden-seed"] as const;
const SKILL_FRAME_IDS = [
  "skill.leaf-volley",
  "skill.ground-thump",
  "skill.healing-spring",
  "skill.acorn-barrage",
  "skill.vine-snare",
  "skill.bark-shield",
  "skill.firefly-swarm",
  "skill.capybara-rally",
] as const;
const PROJECTILE_FRAME_IDS = [
  "projectile.acorn",
  "projectile.leaf-dart",
  "projectile.water-drop",
  "projectile.golden-seed",
] as const;
const SLOT_FRAME_IDS = ["slot.weapon", "slot.hat", "slot.armor", "slot.charm"] as const;
const BODY_FRAME_IDS = [
  "monster.body.frog",
  "monster.body.heron",
  "monster.body.caiman",
  "monster.body.beetle",
  "monster.body.snail",
  "monster.body.fish",
  "monster.body.turtle",
  "monster.body.moth",
  "monster.body.mushroom",
  "monster.body.reed",
] as const;
const FACE_FRAME_IDS = Array.from({ length: 10 }, (_, index) => `monster.face.${index + 1}` as const);
const DECORATION_FRAME_IDS = Array.from(
  { length: 10 },
  (_, index) => `monster.decoration.${index + 1}` as const,
);
const BOSS_FRAME_IDS = Array.from({ length: 10 }, (_, index) => `boss.${index + 1}` as const);
const MAP_FRAME_IDS = ["map.wetland", "map.sunset", "map.onsen"] as const;
const PATH_FRAME_IDS = ["path.wetland", "path.sunset", "path.onsen"] as const;

export const REQUIRED_DEFENSE_FRAME_IDS = [
  ...CLASS_FRAME_IDS,
  ...EQUIPMENT_FRAME_IDS,
  ...TIER_FRAME_IDS,
  ...DROP_FRAME_IDS,
  ...SKILL_FRAME_IDS,
  ...PROJECTILE_FRAME_IDS,
  ...SLOT_FRAME_IDS,
  ...BODY_FRAME_IDS,
  ...FACE_FRAME_IDS,
  ...DECORATION_FRAME_IDS,
  ...BOSS_FRAME_IDS,
  ...MAP_FRAME_IDS,
  ...PATH_FRAME_IDS,
] as const;

export type DefenseFrameId = (typeof REQUIRED_DEFENSE_FRAME_IDS)[number];
type DefenseAtlasId = keyof typeof DEFENSE_ATLASES;
export type DefenseFrame = Readonly<{
  id: DefenseFrameId;
  atlas: DefenseAtlasId;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export function isDefenseFrameInsideAtlas(frame: DefenseFrame): boolean {
  const atlas = DEFENSE_ATLASES[frame.atlas];
  return (
    frame.x >= 0 &&
    frame.y >= 0 &&
    frame.width > 0 &&
    frame.height > 0 &&
    frame.x + frame.width <= atlas.width &&
    frame.y + frame.height <= atlas.height
  );
}

type GridSpec = Readonly<{
  atlas: DefenseAtlasId;
  ids: readonly DefenseFrameId[];
  columns: number;
  cellWidth: number;
  cellHeight: number;
  offsetY?: number;
}>;

function gridFrames({
  atlas,
  ids,
  columns,
  cellWidth,
  cellHeight,
  offsetY = 0,
}: GridSpec): readonly DefenseFrame[] {
  return ids.map((id, index) => ({
    id,
    atlas,
    x: (index % columns) * cellWidth,
    y: offsetY + Math.floor(index / columns) * cellHeight,
    width: cellWidth,
    height: cellHeight,
  }));
}

export const DEFENSE_FRAMES = [
  ...gridFrames({
    atlas: "units",
    ids: [
      ...CLASS_FRAME_IDS,
      ...EQUIPMENT_FRAME_IDS,
      ...TIER_FRAME_IDS,
      ...DROP_FRAME_IDS,
      ...SKILL_FRAME_IDS,
      ...PROJECTILE_FRAME_IDS,
      ...SLOT_FRAME_IDS,
    ],
    columns: 8,
    cellWidth: 128,
    cellHeight: 256,
  }),
  ...gridFrames({
    atlas: "monsters",
    ids: [...BODY_FRAME_IDS, ...FACE_FRAME_IDS, ...DECORATION_FRAME_IDS],
    columns: 5,
    cellWidth: 240,
    cellHeight: 200,
  }),
  ...gridFrames({ atlas: "bosses", ids: BOSS_FRAME_IDS, columns: 5, cellWidth: 200, cellHeight: 250 }),
  ...gridFrames({ atlas: "maps", ids: MAP_FRAME_IDS, columns: 3, cellWidth: 512, cellHeight: 768 }),
  ...gridFrames({
    atlas: "maps",
    ids: PATH_FRAME_IDS,
    columns: 3,
    cellWidth: 256,
    cellHeight: 256,
    offsetY: 768,
  }),
] as const satisfies readonly DefenseFrame[];

const MONSTER_PALETTES = ["moss", "clay", "river", "reed", "moon"] as const;

export type MonsterTheme = Readonly<{
  id: `monster-theme-${string}`;
  body: (typeof BODY_FRAME_IDS)[number];
  face: (typeof FACE_FRAME_IDS)[number];
  decoration: (typeof DECORATION_FRAME_IDS)[number];
  palette: (typeof MONSTER_PALETTES)[number];
}>;

export function getMonsterTheme(round: number): MonsterTheme {
  if (!Number.isInteger(round) || round < 1 || round > 100) {
    throw new RangeError("Monster round must be an integer from 1 to 100.");
  }
  const index = round - 1;
  return {
    id: `monster-theme-${String(round).padStart(3, "0")}`,
    body: BODY_FRAME_IDS[index % BODY_FRAME_IDS.length] ?? BODY_FRAME_IDS[0],
    face: FACE_FRAME_IDS[(index * 3) % FACE_FRAME_IDS.length] ?? FACE_FRAME_IDS[0],
    decoration:
      DECORATION_FRAME_IDS[(index * 7) % DECORATION_FRAME_IDS.length] ?? DECORATION_FRAME_IDS[0],
    palette: MONSTER_PALETTES[(index * 2) % MONSTER_PALETTES.length] ?? MONSTER_PALETTES[0],
  };
}
