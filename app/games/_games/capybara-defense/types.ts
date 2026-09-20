export type HeroClass = "warrior" | "archer" | "rogue" | "mage";
export type HeroTier = "common" | "rare" | "epic" | "legendary" | "mythic" | "primordial";
export type MapId = "reed-marsh" | "hot-spring" | "moonlit-orchard";
export type EquipmentSlot = "weapon" | "armor" | "accessory";
export type RoundKind = "normal" | "shield" | "boss";
export type DefensePhase = "combat" | "preparation" | "result";
export type DefenseOutcome = "clear" | "failure" | null;
export type ClockSpeed = 1 | 2;
export type MonsterKind = "normal" | "fast" | "boss";
export type TargetPriority = "first" | "last" | "strongest" | "nearest";
export type TierValues = readonly [number, number, number, number, number, number];
export type RandomSource = () => number;
export type ProbabilityTable<Key extends string> = Readonly<Record<Key, number>>;
export type HeroUnitId = `hero-${number}`;

export type HeroUnitStats = {
  readonly attackBonus: number;
  readonly kills: number;
};

export type HeroUnit = {
  readonly id: HeroUnitId;
  readonly heroClass: HeroClass;
  readonly tier: HeroTier;
  readonly stats: HeroUnitStats;
  readonly equipment: Readonly<Partial<Record<EquipmentSlot, string>>>;
};

export type HeroDrawState = {
  readonly lowTierStreak: number;
  readonly missingClassStreak: number;
};

export type HeroInventory = {
  readonly units: readonly HeroUnit[];
  readonly economy: EconomyState;
  readonly tickets: number;
  readonly awardedTicketRounds: readonly number[];
  readonly nextUnitId: number;
  readonly drawState: HeroDrawState;
};

export type DefenseMap = {
  readonly id: MapId;
  readonly name: string;
  readonly gimmick: "slow-zone" | "mana-spring" | "critical-grove";
  readonly pathLength: number;
  readonly path: readonly [MapPoint, MapPoint, MapPoint, MapPoint, MapPoint];
  readonly gimmickZone: readonly [number, number];
};

export type MapPoint = {
  readonly x: number;
  readonly y: number;
};

export type MonsterEntity = {
  id: number;
  active: boolean;
  round: number;
  kind: MonsterKind;
  progress: number;
  speed: number;
  targetSpeed: number;
  baseSpeed: number;
  warningRemainingMs: number;
  maxHealth: number;
  health: number;
  maxShield: number;
  shield: number;
  leakDamage: number;
  vulnerable: boolean;
  manaSpringTriggered: boolean;
};

export type ProjectileEntity = {
  id: number;
  active: boolean;
  x: number;
  y: number;
};

export type DamageNumberEntity = {
  id: number;
  active: boolean;
  value: number;
};

export type DefenseFailure =
  | { readonly kind: "lives"; readonly lives: 0 }
  | { readonly kind: "overload"; readonly current: number; readonly limit: number };

// Mutable by design: one deterministic simulation owns and reuses these pools.
export type DefenseEngine = {
  map: DefenseMap;
  phase: DefensePhase;
  outcome: DefenseOutcome;
  failure: DefenseFailure | null;
  round: number;
  phaseElapsedMs: number;
  totalElapsedMs: number;
  clockSpeed: ClockSpeed;
  lives: number;
  leakCount: number;
  spawnIndex: number;
  totalSpawned: number;
  manaGenerated: number;
  nextEntityId: number;
  monsters: MonsterEntity[];
  projectiles: ProjectileEntity[];
  damageNumbers: DamageNumberEntity[];
};

export type HeroStats = {
  readonly baseAttack: number;
  readonly attackIntervalMs: TierValues;
  readonly range: TierValues;
  readonly projectileCount: TierValues;
  readonly specialty: "ramp" | "multi-shot" | "bounce" | "area";
};

export type SkillDefinition = {
  readonly id: string;
  readonly heroClass: HeroClass;
  readonly name: string;
  readonly manaCost: number;
  readonly cooldownMs: number;
  readonly radius: number;
  readonly durationMs: number;
};

export type MonsterTheme = {
  readonly id: `monster-theme-${string}`;
  readonly round: number;
  readonly body: `monster.body.${string}`;
  readonly face: `monster.face.${number}`;
  readonly decoration: `monster.decoration.${number}`;
  readonly palette: "moss" | "clay" | "river" | "reed" | "moon";
  readonly hue: number;
  readonly sizeMultiplier: number;
  readonly speedMultiplier: number;
  readonly healthMultiplier: number;
  readonly armorBonus: number;
  readonly special: "steady" | "swift" | "armored" | "regenerating" | "splitting" | "slowing";
};

export type BossAbilityId =
  | "marsh-charge"
  | "steam-heal"
  | "moon-stomp"
  | "reed-bulwark"
  | "citrus-haste"
  | "acorn-volley"
  | "lotus-bind"
  | "waterfall-push"
  | "golden-roar"
  | "primal-split";

export type BossDefinition = {
  readonly id: `boss-${number}`;
  readonly round: number;
  readonly name: string;
  readonly ability: BossAbilityId;
  readonly abilityName: string;
  readonly warningText: string;
  readonly warningShape: "lane" | "circle" | "ring" | "boss";
  readonly windupMs: number;
  readonly firstUseDelayMs: number;
  readonly scale: number;
  readonly healthMultiplier: number;
  readonly shieldMultiplier: number;
};

export type RoundConfig = {
  readonly round: number;
  readonly kind: RoundKind;
  readonly spawnCount: number;
  readonly health: number;
  readonly speed: number;
  readonly armor: number;
  readonly shieldRatio: number;
  readonly personalShieldChance: number;
  readonly withinPairDelayMs: number;
  readonly betweenPairDelayMs: number;
  readonly fastEnemyResponseMs: number;
  readonly theme: MonsterTheme;
  readonly boss: BossDefinition | null;
};

export type MonsterVitals = {
  readonly health: number;
  readonly maxHealth: number;
  readonly shield: number;
  readonly maxShield: number;
};

export type MonsterDamageInput = {
  readonly amount: number;
  readonly kind: "normal" | "shield-break";
};

export type MonsterDamageResult = {
  readonly vitals: MonsterVitals;
  readonly shieldDamage: number;
  readonly healthDamage: number;
  readonly shieldBroken: boolean;
};

export type WavePreview = {
  readonly round: number;
  readonly count: number;
  readonly kind: RoundKind;
  readonly keyTraits: readonly string[];
  readonly shieldRatio: number;
  readonly isBoss: boolean;
  readonly boss: null | {
    readonly name: string;
    readonly abilityName: string;
    readonly warningText: string;
    readonly warningMs: number;
  };
};

export type PopulationAlert = {
  readonly count: number;
  readonly level: "safe" | "warning" | "danger" | "failure";
  readonly text: string;
  readonly icon: "none" | "warning-paw" | "danger-paw";
  readonly sound: "none" | "population-warning" | "population-danger" | "defense-failure";
  readonly shouldFail: boolean;
};

export type AttackDamageInput = {
  readonly heroClass: HeroClass;
  readonly tier: HeroTier;
  readonly classUpgradeLevel: number;
  readonly tierUpgradeLevel: number;
  readonly equipmentAttackBonus: number;
};

export type UpgradeTarget =
  | { readonly kind: "class"; readonly heroClass: HeroClass }
  | { readonly kind: "tier"; readonly tier: HeroTier };

export type EconomyState = {
  readonly money: number;
  readonly kills: number;
  readonly classUpgradeLevels: Readonly<Record<HeroClass, number>>;
  readonly tierUpgradeLevels: Readonly<Record<HeroTier, number>>;
};

export type UpgradePreview = {
  readonly target: UpgradeTarget;
  readonly currentLevel: number;
  readonly nextLevel: number | null;
  readonly cost: number | null;
  readonly currentEffect: number;
  readonly nextEffect: number;
};

export type InsufficientFunds = {
  readonly kind: "insufficient-funds";
  readonly state: EconomyState;
  readonly currentMoney: number;
  readonly cost: number;
  readonly missingMoney: number;
  readonly message: string;
};

export type SharedMoneySpendResult =
  | { readonly kind: "spent"; readonly state: EconomyState }
  | InsufficientFunds;

export type UpgradePurchaseResult =
  | { readonly kind: "purchased"; readonly state: EconomyState; readonly target: UpgradeTarget }
  | { readonly kind: "max-level"; readonly state: EconomyState; readonly message: string }
  | InsufficientFunds;

export type DefenseSimulation = {
  readonly mapId: MapId;
  readonly seed: number;
  readonly cleared: boolean;
  readonly roundsCompleted: number;
  readonly failedRound: number | null;
  readonly livesRemaining: number;
  readonly bossRounds: number;
  readonly shieldRounds: number;
  readonly minimumMoney: number;
  readonly endingMoney: number;
  readonly totalKills: number;
  readonly totalLeaks: number;
  readonly draws: number;
  readonly merges: number;
  readonly classUpgradePurchases: number;
  readonly tierUpgradePurchases: number;
  readonly equipmentDrops: number;
  readonly ticketChallengesWon: number;
  readonly damageDealt: number;
  readonly estimatedClearMinutes: number;
  readonly scheduleChecksum: number;
};

export type DefenseSimulationOptions = {
  readonly policy?: "normal" | "no-spend";
  readonly enemyHealthMultiplier?: number;
};

export class DefenseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DefenseConfigError";
  }
}

export function parseHeroClass(input: string): HeroClass {
  switch (input) {
    case "warrior":
    case "archer":
    case "rogue":
    case "mage":
      return input;
    default:
      throw new DefenseConfigError(`Unknown hero class: ${input}`);
  }
}

export function parseHeroTier(input: string): HeroTier {
  switch (input) {
    case "common":
    case "rare":
    case "epic":
    case "legendary":
    case "mythic":
    case "primordial":
      return input;
    default:
      throw new DefenseConfigError(`Unknown hero tier: ${input}`);
  }
}

export function parseMapId(input: string): MapId {
  switch (input) {
    case "reed-marsh":
    case "hot-spring":
    case "moonlit-orchard":
      return input;
    default:
      throw new DefenseConfigError(`Unknown defense map: ${input}`);
  }
}
