import { Leaderboard, TierLabel } from "@/components/games/leaderboard";

import { LEADERBOARD_SIZE, type ReactionRecord } from "./records";
import { getTier, getTierRangeLabel, REACTION_TIERS } from "./tiers";

const COLUMNS = [
  { key: "record", header: "기록" },
  { key: "tier", header: "등급", align: "right" },
] as const;

const LEGEND = REACTION_TIERS.map((tier) => ({
  label: tier.label,
  range: getTierRangeLabel(tier),
  dotClass: tier.bgClass,
}));

interface ReactionLeaderboardProps {
  records: readonly ReactionRecord[];
  highlightId?: string;
}

export function ReactionLeaderboard({ records, highlightId }: ReactionLeaderboardProps) {
  const rows = records.map((record) => {
    const tier = getTier(record.ms);
    return {
      id: record.id,
      cells: {
        record: `${record.ms}ms`,
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
      legend={LEGEND}
    />
  );
}
