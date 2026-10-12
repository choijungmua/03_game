import { GAME_SOUNDS } from "@/lib/games/constants";
import { playGameSound } from "@/lib/lobby/settings";
import type { DefenseState } from "./engine";
import { rarityRank } from "./defense-rules";

export function createDefenseAudio() {
  let previous: DefenseState | null = null;
  let lastAttack = -Infinity;
  let enabled = false;
  return {
    unlock() { enabled = true; },
    observe(state: DefenseState, now: number) {
      const before = previous;
      if (!before || state.seed !== before.seed || state.phase === "idle" || (state.elapsedMs === 0 && state.nextId === 1)) {
        previous = state;
        lastAttack = -Infinity;
        return;
      }
      if (before === state || state.elapsedMs < before.elapsedMs || state.nextId < before.nextId) return;
      previous = state;
      if (!enabled) return;
      const acquired = state.units.filter(unit => unit.id >= before.nextId);
      if (state.phase === "won" && before.phase !== "won") playGameSound(GAME_SOUNDS.success);
      else if (state.phase === "lost" && before.phase !== "lost") playGameSound(GAME_SOUNDS.fail);
      else if (acquired.some(unit => rarityRank(unit.rarity) >= rarityRank("legendary"))) playGameSound(GAME_SOUNDS.record);
      else if (state.tickets.some(ticket => ticket.id >= before.nextId)) playGameSound(GAME_SOUNDS.correct);
      else if (acquired.length) playGameSound(GAME_SOUNDS.pickup);
      else if (state.units.some(unit => unit.mana < (before.units.find(prior => prior.id === unit.id)?.mana ?? 0))) playGameSound(GAME_SOUNDS.whoosh);
      else if (state.enemies.some(enemy => enemy.isBoss && !before.enemies.some(prior => prior.id === enemy.id))) playGameSound(GAME_SOUNDS.warning);
      else if (now - lastAttack >= 180 && state.units.some(unit => unit.cooldownMs > (before.units.find(prior => prior.id === unit.id)?.cooldownMs ?? Infinity))) {
        lastAttack = now;
        playGameSound(GAME_SOUNDS.hit);
      }
    },
  };
}
