export interface WatermelonTier {
  label: string;
  /** 점수가 이 값 이상이면 이 등급 */
  minScore: number;
  description: string;
  bgClass: string;
  fgClass: string;
}

export const WATERMELON_TIERS: readonly WatermelonTier[] = [
  {
    label: "수박 장인",
    minScore: 3000,
    description: "상자를 꽉 채워도 끝까지 합쳐 냈어요",
    bgClass: "bg-violet-600",
    fgClass: "text-white",
  },
  {
    label: "멜론 농부",
    minScore: 2000,
    description: "큰 과일을 한쪽에 모으는 요령을 알아요",
    bgClass: "bg-primary",
    fgClass: "text-white",
  },
  {
    label: "과일 가게 사장",
    minScore: 1200,
    description: "합체 순서를 보고 떨어뜨리고 있어요",
    bgClass: "bg-success",
    fgClass: "text-neutral-950",
  },
  {
    label: "과일 바구니",
    minScore: 500,
    description: "작은 과일을 큰 과일 옆에 두지 않게 해 보세요",
    bgClass: "bg-warning",
    fgClass: "text-neutral-950",
  },
  {
    label: "체리 새싹",
    minScore: 0,
    description: "같은 과일끼리 닿게 떨어뜨리면 커져요",
    bgClass: "bg-destructive",
    fgClass: "text-neutral-950",
  },
];

export function getWatermelonTier(score: number): WatermelonTier {
  return WATERMELON_TIERS.find((tier) => score >= tier.minScore) ?? WATERMELON_TIERS[WATERMELON_TIERS.length - 1];
}

export function getWatermelonTierRangeLabel(tier: WatermelonTier): string {
  const index = WATERMELON_TIERS.indexOf(tier);
  if (index === 0) return `${tier.minScore}점 이상`;
  return `${tier.minScore}–${WATERMELON_TIERS[index - 1].minScore - 1}점`;
}
