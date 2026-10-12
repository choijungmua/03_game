import { rarityRank } from "./defense-rules";
import type { DefenseRarity } from "./defense-model";

export const CAPYBARA_SPRITE = "/assets/images/characters/capybara-3d/capybara-stand-down-right.webp";
export const RARITY_COLORS: Record<DefenseRarity, string> = {
  common: "#ddd7bb", rare: "#80c4e4", ancient: "#8fc9a0", relic: "#e6bd79", saga: "#bfa4ec",
  legendary: "#f7cc71", epic: "#c5a0ee", mythic: "#835883", primordial: "#fff1ca", apocalypse: "#b87967",
};
export function getDefenderVisual(rarity: DefenseRarity) {
  const rank = rarityRank(rarity);
  return { rank, size: 46, color: RARITY_COLORS[rarity], rings: rank >= 5 ? 2 : 1, sparks: rank >= 5 ? rank - 2 : 0 };
}

export function getBattlePressure(enemies: number, limit: number) {
  const ratio = Math.min(1, Math.max(0, enemies / limit));
  return { ratio, label: ratio >= 0.75 ? "붕괴 위험" : ratio >= 0.4 ? "적이 쌓이고 있어요" : "수비 안정", level: ratio >= 0.75 ? "danger" : ratio >= 0.4 ? "warning" : "stable" };
}
