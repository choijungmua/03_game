export interface PlaneShooterTier {
  label: string;
  /** 도달한 스테이지가 이 값 이상이면 이 등급 */
  minStage: number;
  description: string;
  bgClass: string;
  fgClass: string;
}

export const PLANE_SHOOTER_TIERS: readonly PlaneShooterTier[] = [
  {
    label: "전설",
    minStage: 16,
    description: "카이만 보스를 세 번 버텨낸 전설의 카피바라예요",
    bgClass: "bg-violet-600",
    fgClass: "text-white",
  },
  {
    label: "에이스",
    minStage: 11,
    description: "카이만 보스를 두 번 버텨낸 실력이에요",
    bgClass: "bg-primary",
    fgClass: "text-white",
  },
  {
    label: "베테랑",
    minStage: 6,
    description: "첫 카이만 보스를 넘긴 조종사예요",
    bgClass: "bg-success",
    fgClass: "text-neutral-950",
  },
  {
    label: "조종사",
    minStage: 3,
    description: "카이만 보스와 맞붙을 만한 실력이에요",
    bgClass: "bg-warning",
    fgClass: "text-neutral-950",
  },
  {
    label: "훈련생",
    minStage: 1,
    description: "간식을 먹고 무기 레벨을 올려 보세요",
    bgClass: "bg-destructive",
    fgClass: "text-neutral-950",
  },
];

export function getPlaneShooterTier(stage: number): PlaneShooterTier {
  return (
    PLANE_SHOOTER_TIERS.find((tier) => stage >= tier.minStage) ??
    PLANE_SHOOTER_TIERS[PLANE_SHOOTER_TIERS.length - 1]
  );
}

export function getPlaneShooterTierRangeLabel(tier: PlaneShooterTier): string {
  const index = PLANE_SHOOTER_TIERS.indexOf(tier);
  if (index === 0) return `${tier.minStage}스테이지 이상`;
  return `${tier.minStage}–${PLANE_SHOOTER_TIERS[index - 1].minStage - 1}스테이지`;
}
