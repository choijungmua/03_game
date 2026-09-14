import { Leaderboard, TierLabel } from "@/components/games/leaderboard";

import { formatSeconds } from "./logic";
import { LEADERBOARD_SIZE, type LogDodgeRecord } from "./records";
import { getLogDodgeTier, getLogDodgeTierRangeLabel, LOG_DODGE_TIERS } from "./tiers";

const COLUMNS = [
  { key: "time", header: "기록" },
  { key: "course", header: "코스" },
  { key: "tier", header: "등급", align: "right" },
] as const;

const LEGEND = LOG_DODGE_TIERS.map((tier) => ({
  label: tier.label,
  range: getLogDodgeTierRangeLabel(tier),
  dotClass: tier.bgClass,
}));

interface LogDodgeLeaderboardProps {
  records: readonly LogDodgeRecord[];
  highlightId?: string;
}

function formatCourse(course: string | null) {
  if (!course) return "연습";
  const [, month, day] = course.split("-");
  return `${Number(month)}/${Number(day)} 코스`;
}

export function LogDodgeLeaderboard({ records, highlightId }: LogDodgeLeaderboardProps) {
  const rows = records.map((record) => {
    const tier = getLogDodgeTier(record.timeMs);
    return {
      id: record.id,
      cells: {
        time: `${formatSeconds(record.timeMs)}초`,
        course: formatCourse(record.course),
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
      legendTitle="등급 기준 (버틴 시간)"
      legend={LEGEND}
    />
  );
}
