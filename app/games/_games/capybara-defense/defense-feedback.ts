import { getWaveInfo, RARITIES, RULES } from "./engine";
import type { DefenseState } from "./engine";

export function getDefenseReward(before: DefenseState, next: DefenseState) {
  if (before.seed !== next.seed || next.elapsedMs < before.elapsedMs || next.nextId < before.nextId) return null;
  const units = next.units.filter(unit => !before.units.some(prior => prior.id === unit.id));
  const tickets = next.tickets.filter(ticket => !before.tickets.some(prior => prior.id === ticket.id));
  const milestones = next.killMilestones.filter(kills => !before.killMilestones.includes(kills));
  const collections = next.registeredCollections.filter(id => !before.registeredCollections.includes(id));
  if (!units.length && !tickets.length && !milestones.length && !collections.length) return null;
  const bossDefeated = tickets.length > 0 && next.kills > before.kills && before.enemies.some(enemy => enemy.isBoss && !next.enemies.some(current => current.id === enemy.id));
  return {
    units, tickets, milestones, collections, bossDefeated,
    celebrated: [...units, ...tickets].some(item => RARITIES.findIndex(rarity => rarity.id === item.rarity) >= RARITIES.findIndex(rarity => rarity.id === "legendary")),
  };
}

export function getNextDefenseGoal(round: number) {
  for (let next = Math.max(1, round + 1); next <= RULES.totalRounds; next++) {
    const wave = getWaveInfo(next);
    if (wave.bossCount || wave.bonus) return wave;
  }
  return null;
}
