import type { ReactNode } from "react";

export interface LeaderboardColumn {
  key: string;
  header: string;
  align?: "left" | "right";
}

export interface LeaderboardRow {
  id: string;
  cells: Record<string, ReactNode>;
}

export interface LeaderboardLegendItem {
  label: string;
  range: string;
  dotClass: string;
}

export interface LeaderboardProps {
  columns: readonly LeaderboardColumn[];
  rows: readonly LeaderboardRow[];
  size: number;
  highlightId?: string;
  legendTitle?: string;
  legend?: readonly LeaderboardLegendItem[];
}

export interface TierLabelProps {
  label: string;
  dotClass: string;
}
