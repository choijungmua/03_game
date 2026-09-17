export interface PangTier {
  label: string;
  /** 점수가 이 값 이상이면 이 등급 */
  minScore: number;
  description: string;
  bgClass: string;
  fgClass: string;
}

// ponytail: 기준 점수는 어림값. 실제 플레이 기록이 쌓이면 분포를 보고 조정
export const PANG_TIERS: readonly PangTier[] = [
  { label: "팡팡 마스터", minScore: 15000, description: "콤보가 끊기질 않네요", bgClass: "bg-violet-600", fgClass: "text-white" },
  { label: "고수", minScore: 10000, description: "피버를 자유자재로 다뤄요", bgClass: "bg-primary", fgClass: "text-white" },
  { label: "중수", minScore: 6000, description: "손이 꽤 빨라요", bgClass: "bg-success", fgClass: "text-neutral-950" },
  { label: "초보", minScore: 3000, description: "콤보를 이어 보세요", bgClass: "bg-warning", fgClass: "text-neutral-950" },
  { label: "새싹", minScore: 0, description: "천천히 줄을 찾아봐요", bgClass: "bg-destructive", fgClass: "text-neutral-950" },
];

export function getPangTier(score: number): PangTier {
  return PANG_TIERS.find((tier) => score >= tier.minScore) ?? PANG_TIERS[PANG_TIERS.length - 1];
}

export function getPangTierRangeLabel(tier: PangTier): string {
  const index = PANG_TIERS.indexOf(tier);
  const format = (value: number) => value.toLocaleString("ko-KR");
  if (index === 0) return `${format(tier.minScore)}점 이상`;
  const upper = PANG_TIERS[index - 1].minScore;
  if (index === PANG_TIERS.length - 1) return `${format(upper)}점 미만`;
  return `${format(tier.minScore)}–${format(upper - 1)}점`;
}
