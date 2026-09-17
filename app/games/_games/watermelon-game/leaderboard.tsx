import { Leaderboard, TierLabel } from "@/components/games/leaderboard";

import { FRUITS } from "./constants";
import { LEADERBOARD_SIZE, type WatermelonRecord } from "./records";
import { getWatermelonTier, getWatermelonTierRangeLabel, WATERMELON_TIERS } from "./tiers";

const COLUMNS = [
  { key: "score", header: "점수" },
  { key: "fruit", header: "최대 과일" },
  { key: "tier", header: "등급", align: "right" },
] as const;

const LEGEND = WATERMELON_TIERS.map((tier) => ({
  label: tier.label,
  range: getWatermelonTierRangeLabel(tier),
  dotClass: tier.bgClass,
}));

interface WatermelonLeaderboardProps {
  records: readonly WatermelonRecord[];
  highlightId?: string;
}

export function WatermelonLeaderboard({ records, highlightId }: WatermelonLeaderboardProps) {
  const rows = records.map((record) => {
    const tier = getWatermelonTier(record.score);
    return {
      id: record.id,
      cells: {
        score: `${record.score.toLocaleString("ko-KR")}점`,
        fruit: FRUITS[record.maxLevel]?.name ?? "-",
        tier: <TierLabel label={tier.label} dotClass={tier.bgClass} />,
      },
    };
  });

  return (
    <Leaderboard
      columns={COLUMNS}
      rows={rows}
      size={LEADERBOARD_SIZE}
      highlightId={highlightId}
      legendTitle="등급 기준 (점수)"
      legend={LEGEND}
    />
  );
}
