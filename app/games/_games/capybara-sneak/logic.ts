export interface DurationRange {
  min: number;
  max: number;
}

export interface OwnerLook {
  /** true면 흘끗 보고 금방 다시 등을 돌린다 */
  glance: boolean;
  ms: number;
}

export type FoodStage = "full" | "half" | "empty";

/** 한 입에 차는 게이지(%) */
export const EAT_STEP = 1;
/** 누른 뒤 첫 입이 들어가기까지의 딜레이. 이보다 짧게 톡 치면 먹지 않는다 */
export const EAT_DELAY_MS = 200;
/** 꾹 누르고 있는 동안 한 입씩 먹는 간격 */
export const EAT_INTERVAL_MS = 80;

/** 주인이 등을 돌리고 있는 시간 */
export const AWAY_MS_RANGE: DurationRange = { min: 800, max: 3500 };
/** 주인이 돌아보기 전 "!" 경고 시간. 사람이 보고 손을 떼는 데 0.25초쯤 걸리므로 0.3초보다 짧게 두지 않는다 */
export const WARNING_MS_RANGE: DurationRange = { min: 300, max: 600 };
/** 주인이 제대로 지켜보는 시간 */
export const LOOK_MS_RANGE: DurationRange = { min: 1000, max: 1800 };
/** 흘끗 보고 바로 등을 돌리는 시간 */
export const GLANCE_MS_RANGE: DurationRange = { min: 350, max: 600 };
/** 돌아볼 때 흘끗 보기가 나올 확률 */
export const GLANCE_CHANCE = 0.35;

/** 안 먹을 때 줄어드는 게이지(%) */
export const DECAY_STEP = 1;
/** 손을 떼고 게이지가 줄기 시작할 때까지의 여유 */
export const DECAY_GRACE_MS = 500;
/** 게이지가 줄어드는 간격 */
export const DECAY_INTERVAL_MS = 400;

export function pickDuration(range: DurationRange, random: () => number = Math.random): number {
  return Math.round(range.min + random() * (range.max - range.min));
}

/** 경고 시간은 랜덤이고, 게이지가 오를수록 가장 긴 경고 시간이 짧아져 막판일수록 긴장된다 */
export function pickWarningMs(gauge: number, random: () => number = Math.random): number {
  const { min, max } = WARNING_MS_RANGE;
  const progress = Math.min(100, Math.max(0, gauge)) / 100;
  const longest = max - (max - min) * progress;
  return Math.round(min + random() * (longest - min));
}

export function pickLook(random: () => number = Math.random): OwnerLook {
  const glance = random() < GLANCE_CHANCE;
  return { glance, ms: pickDuration(glance ? GLANCE_MS_RANGE : LOOK_MS_RANGE, random) };
}

export function addBite(gauge: number): number {
  return Math.min(100, gauge + EAT_STEP);
}

export function decayGauge(gauge: number): number {
  return Math.max(0, gauge - DECAY_STEP);
}

export function getFoodStage(gauge: number): FoodStage {
  if (gauge >= 100) return "empty";
  if (gauge >= 50) return "half";
  return "full";
}
