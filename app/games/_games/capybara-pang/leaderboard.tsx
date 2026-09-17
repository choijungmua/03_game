import { Leaderboard, TierLabel } from "@/components/games/leaderboard";

import { LEADERBOARD_SIZE, type PangRecord } from "./records";
import { getPangTier, getPangTierRangeLabel, PANG_TIERS } from "./tiers";

const COLUMNS = [
  { key: "score", header: "점수" },
  { key: "combo", header: "최대 콤보" },
  { key: "tier", header: "등급", align: "right" },
] as const;

const LEGEND = PANG_TIERS.map((tier) => ({
  label: tier.label,
  range: getPangTierRangeLabel(tier),
  dotClass: tier.bgClass,
}));

interface PangLeaderboardProps {
  records: readonly PangRecord[];
  highlightId?: string;
}

export function PangLeaderboard({ records, highlightId }: PangLeaderboardProps) {
  const rows = records.map((record) => {
    const tier = getPangTier(record.score);
    return {
      id: record.id,
      cells: {
        score: `${record.score.toLocaleString("ko-KR")}점`,
        combo: `${record.maxCombo}콤보`,
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
