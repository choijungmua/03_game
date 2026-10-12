import type { ActionResult, DefenseEnemy, DefenseState } from "./defense-model";
import { DAMAGE_MATCHUPS, KILL_MILESTONES, RULES, getEnemyPoint, getUnitPoint, getUnitStats, getWaveInfo, getWavePressure } from "./defense-rules";

export function damageEnemy(enemy: DefenseEnemy, stats: ReturnType<typeof getUnitStats>): void {
  const absorbed = Math.min(enemy.shield, stats.damage);
  enemy.shield -= absorbed;
  const remainder = stats.damage - absorbed;
  if (remainder > 0) enemy.hp -= Math.max(1, remainder * DAMAGE_MATCHUPS[stats.attackType][enemy.size] - (stats.bypassArmor ? 0 : enemy.armor));
}
export function castAbility(state: DefenseState, unitId: number, enemyId: number): ActionResult {
  const unit = state.units.find(item => item.id === unitId);
  const enemy = state.enemies.find(item => item.id === enemyId && item.hp > 0);
  if (state.phase !== "playing" || !unit || !enemy) return { state, error: "지원 유닛과 살아 있는 적을 선택해 주세요." };
  const stats = getUnitStats(state, unit);
  const point = getUnitPoint(unit);
  const target = getEnemyPoint(enemy.progress);
  if (!stats.ability || !point || unit.mana < RULES.abilityMana || (point.x - target.x) ** 2 + (point.y - target.y) ** 2 > stats.range ** 2) return { state, error: "지원 능력의 마나와 사거리를 확인해 주세요." };
  const enemies = state.enemies.map(item => {
    const location = getEnemyPoint(item.progress);
    const withinArea = (location.x - target.x) ** 2 + (location.y - target.y) ** 2 <= 150 ** 2;
    switch (stats.ability) {
      case "lockdown": return item.id === enemyId ? { ...item, lockedUntilMs: state.elapsedMs + 3_000 } : item;
      case "ensnare": return withinArea ? { ...item, slowedUntilMs: state.elapsedMs + 6_000 } : item;
      case "emp": return withinArea ? { ...item, shield: 0 } : item;
      case null: return item;
    }
  });
  return { state: { ...state, enemies, units: state.units.map(item => item.id === unitId ? { ...item, mana: item.mana - RULES.abilityMana } : item) }, error: null };
}
export function fight(state: DefenseState): void {
  const positions = state.enemies.map(enemy => {
    const speed = enemy.lockedUntilMs > state.elapsedMs ? 0 : enemy.slowedUntilMs > state.elapsedMs ? 0.4 : 1;
    enemy.progress = (enemy.progress + speed * RULES.tickMs / RULES.enemyLoopMs) % 1;
    return getEnemyPoint(enemy.progress);
  });
  for (const unit of state.units) {
    unit.mana = Math.min(RULES.maxMana, unit.mana + RULES.manaPerSecond * RULES.tickMs / 1_000);
    unit.cooldownMs = Math.max(0, unit.cooldownMs - RULES.tickMs);
    const point = getUnitPoint(unit);
    if (!point || unit.cooldownMs > 0) continue;
    const stats = getUnitStats(state, unit);
    const inRange = (enemy: DefenseEnemy, index: number) => enemy.hp > 0 && (positions[index].x - point.x) ** 2 + (positions[index].y - point.y) ** 2 <= stats.range ** 2;
    let targetIndex = state.enemies.findIndex((enemy, index) => enemy.id === unit.focusEnemyId && inRange(enemy, index));
    if (targetIndex < 0) targetIndex = state.enemies.findIndex(inRange);
    if (targetIndex < 0) continue;
    damageEnemy(state.enemies[targetIndex], stats);
    unit.cooldownMs = stats.attackMs;
    if (stats.splashRadius > 0) {
      const center = positions[targetIndex];
      for (let index = 0; index < state.enemies.length; index += 1) {
        if (index === targetIndex || state.enemies[index].hp <= 0) continue;
        if ((positions[index].x - center.x) ** 2 + (positions[index].y - center.y) ** 2 <= stats.splashRadius ** 2) damageEnemy(state.enemies[index], stats);
      }
    }
  }
  state.enemies = state.enemies.filter(enemy => {
    if (enemy.hp > 0) return true;
    state.kills += 1;
    state.gas += enemy.gasReward;
    if (enemy.isBoss) {
      state.gold += RULES.bossGold;
      state.tickets.push({ id: state.nextId++, rarity: getWaveInfo(enemy.round).rewardRarity });
      if (enemy.round === RULES.totalRounds) state.finalBossDefeated = true;
    }
    return false;
  });
  for (const unit of state.units) {
    if (unit.focusEnemyId !== null && !state.enemies.some(enemy => enemy.id === unit.focusEnemyId)) unit.focusEnemyId = null;
  }
  for (const milestone of KILL_MILESTONES) {
    if (state.kills < milestone.kills || state.killMilestones.includes(milestone.kills)) continue;
    state.killMilestones.push(milestone.kills);
    state.gold += milestone.gold;
    state.tickets.push({ id: state.nextId++, rarity: milestone.ticket });
  }
}
export function spawnWave(state: DefenseState): void {
  const wave = getWaveInfo(state.round);
  while (state.spawnedThisRound < wave.count && state.roundElapsedMs >= state.spawnedThisRound * RULES.spawnIntervalMs) {
    const isBoss = state.spawnedThisRound < wave.bossCount;
    const species = !isBoss && !wave.bonus && state.spawnedThisRound % 3 === 2 ? getWaveInfo(state.round + 1) : wave;
    const hp = Math.ceil((RULES.enemyBaseHp + state.round * RULES.enemyLinearHp + state.round ** 2 * RULES.enemyQuadraticHp) * getWavePressure(state.round) * (isBoss ? RULES.bossHpMultiplier / wave.bossCount : 1));
    const shield = Math.round(hp * species.shieldRatio);
    state.enemies.push({ id: state.nextId++, round: state.round, name: isBoss ? wave.bossName : species.name, size: isBoss ? "large" : species.size,
      progress: 0, hp, maxHp: hp, shield, maxShield: shield, armor: species.armor + Math.floor(state.round / 30), isBoss,
      deadlineMs: isBoss ? state.elapsedMs + wave.bossDurationMs : null, lockedUntilMs: 0, slowedUntilMs: 0, gasReward: wave.bonus ? 5 : isBoss ? 5 : 1 });
    state.spawnedThisRound += 1;
  }
}
