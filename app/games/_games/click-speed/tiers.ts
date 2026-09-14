export interface ClickSpeedTier {
  label: string;
  /** 초당 클릭 수가 이 값 이상이면 이 등급 */
  minCps: number;
  description: string;
  bgClass: string;
  fgClass: string;
}

export const CLICK_SPEED_TIERS: readonly ClickSpeedTier[] = [
  {
    label: "프로게이머",
    minCps: 10,
    description: "손가락이 안 보일 정도예요",
    bgClass: "bg-violet-600",
    fgClass: "text-white",
  },
  {
    label: "게이머",
    minCps: 8,
    description: "평균보다 확실히 빨라요",
    bgClass: "bg-primary",
    fgClass: "text-white",
  },
  {
    label: "정상인",
    minCps: 6,
    description: "딱 평균적인 연타 속도예요",
    bgClass: "bg-success",
    fgClass: "text-neutral-950",
  },
  {
    label: "조금 느림",
    minCps: 4,
    description: "조금만 더 힘내 보세요",
    bgClass: "bg-warning",
    fgClass: "text-neutral-950",
  },
  {
    label: "거북이",
    minCps: 0,
    description: "손목을 풀고 다시 도전해요",
    bgClass: "bg-destructive",
    fgClass: "text-neutral-950",
  },
];

export function getClickSpeedTier(cps: number): ClickSpeedTier {
  return (
    CLICK_SPEED_TIERS.find((tier) => cps >= tier.minCps) ??
    CLICK_SPEED_TIERS[CLICK_SPEED_TIERS.length - 1]
  );
}

export function getClickSpeedTierRangeLabel(tier: ClickSpeedTier): string {
  const index = CLICK_SPEED_TIERS.indexOf(tier);
  if (index === 0) return `${tier.minCps}회/초 이상`;

  const upperCps = CLICK_SPEED_TIERS[index - 1].minCps;
  if (index === CLICK_SPEED_TIERS.length - 1) return `${upperCps}회/초 미만`;
  return `${tier.minCps}–${(upperCps - 0.1).toFixed(1)}회/초`;
}
