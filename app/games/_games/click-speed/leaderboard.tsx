import { Leaderboard, TierLabel } from "@/components/games/leaderboard";

import { type ClickSpeedRecord, LEADERBOARD_SIZE } from "./records";
import { CLICK_SPEED_TIERS, getClickSpeedTier, getClickSpeedTierRangeLabel } from "./tiers";

const COLUMNS = [
  { key: "count", header: "클릭 수" },
  { key: "cps", header: "속도" },
  { key: "tier", header: "등급", align: "right" },
] as const;

const LEGEND = CLICK_SPEED_TIERS.map((tier) => ({
  label: tier.label,
  range: getClickSpeedTierRangeLabel(tier),
  dotClass: tier.bgClass,
}));

interface ClickSpeedLeaderboardProps {
  records: readonly ClickSpeedRecord[];
  highlightId?: string;
}

export function ClickSpeedLeaderboard({ records, highlightId }: ClickSpeedLeaderboardProps) {
  const rows = records.map((record) => {
    const tier = getClickSpeedTier(record.cps);
    return {
      id: record.id,
      cells: {
        count: `${record.count}회`,
        cps: `${record.cps.toFixed(1)}/초`,
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
      legendTitle="등급 기준 (초당 클릭)"
      legend={LEGEND}
    />
  );
}
