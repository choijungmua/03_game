export interface ReactionTier {
  label: string;
  /** 이 값 미만(ms)이면 이 등급 */
  maxMs: number;
  description: string;
  bgClass: string;
  fgClass: string;
}

export const REACTION_TIERS: readonly ReactionTier[] = [
  {
    label: "프로게이머",
    maxMs: 150,
    description: "프로 선수급 반사신경이에요",
    bgClass: "bg-violet-600",
    fgClass: "text-white",
  },
  {
    label: "게이머",
    maxMs: 200,
    description: "평균보다 확실히 빨라요",
    bgClass: "bg-primary",
    fgClass: "text-white",
  },
  {
    label: "정상인",
    maxMs: 260,
    description: "딱 평균적인 반응속도예요",
    bgClass: "bg-success",
    fgClass: "text-neutral-950",
  },
  {
    label: "조금 느림",
    maxMs: 350,
    description: "조금만 더 집중해 보세요",
    bgClass: "bg-warning",
    fgClass: "text-neutral-950",
  },
  {
    label: "거북이",
    maxMs: Number.POSITIVE_INFINITY,
    description: "잠깐 쉬었다가 다시 도전해요",
    bgClass: "bg-destructive",
    fgClass: "text-neutral-950",
  },
];

export function getTier(ms: number): ReactionTier {
  return REACTION_TIERS.find((tier) => ms < tier.maxMs) ?? REACTION_TIERS[REACTION_TIERS.length - 1];
}

export function getTierRangeLabel(tier: ReactionTier): string {
  const index = REACTION_TIERS.indexOf(tier);
  if (index === 0) return `${tier.maxMs}ms 미만`;

  const minMs = REACTION_TIERS[index - 1].maxMs;
  if (!Number.isFinite(tier.maxMs)) return `${minMs}ms 이상`;
  return `${minMs}–${tier.maxMs - 1}ms`;
}
