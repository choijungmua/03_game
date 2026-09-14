import { Leaderboard, TierLabel } from "@/components/games/leaderboard";

import { formatScore, LEADERBOARD_SIZE, type PlaneShooterRecord } from "./records";
import {
  getPlaneShooterTier,
  getPlaneShooterTierRangeLabel,
  PLANE_SHOOTER_TIERS,
} from "./tiers";

const COLUMNS = [
  { key: "score", header: "점수" },
  { key: "stage", header: "스테이지" },
  { key: "tier", header: "등급", align: "right" },
] as const;

const LEGEND = PLANE_SHOOTER_TIERS.map((tier) => ({
  label: tier.label,
  range: getPlaneShooterTierRangeLabel(tier),
  dotClass: tier.bgClass,
}));

interface PlaneShooterLeaderboardProps {
  records: readonly PlaneShooterRecord[];
  highlightId?: string;
}

export function PlaneShooterLeaderboard({ records, highlightId }: PlaneShooterLeaderboardProps) {
  const rows = records.map((record) => {
    const tier = getPlaneShooterTier(record.stage);
    return {
      id: record.id,
      cells: {
        score: `${formatScore(record.score)}점`,
        stage: `${record.stage}`,
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
      legendTitle="등급 기준 (도달 스테이지)"
      legend={LEGEND}
    />
  );
}
