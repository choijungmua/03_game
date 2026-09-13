import type { ComponentType } from "react";

export type RetryTier = "S" | "A" | "B" | "C";
export type PlayDifficulty = "쉬움" | "보통" | "어려움";

export interface GameEntry {
  slug: string;
  title: string;
  description: string;
  tier: RetryTier;
  playDifficulty: PlayDifficulty;
  component: ComponentType;
}
