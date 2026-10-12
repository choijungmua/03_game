import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getWaveInfo, RULES } from "./engine";
import { SIMULATION_SEEDS, simulateGame } from "./balance-simulation";

describe("production engine balance", () => {
  it("Given ordinary strategies across seeds When all 120 rounds run Then rewards are usable and investment decides outcomes", () => {
    const policies = ["balanced", "ranged", "no-spend", "no-upgrades", "no-apocalypse"] as const;
    const results = policies.flatMap(policy => SIMULATION_SEEDS.map(seed => simulateGame(seed, policy)));
    const summaries = policies.map(policy => {
      const runs = results.filter(result => result.policy === policy);
      return { policy, runs: runs.length, wins: runs.filter(result => result.phase === "won").length, failures: runs.filter(result => result.phase === "lost").map(result => result.failedRound) };
    });
    const evidenceDir = process.env.DEFENSE_EVIDENCE_DIR ?? ".omo/evidence/defense-full";
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(evidenceDir + "/engine-balance.json", JSON.stringify({ scenario: "Public-command ordinary policies through complete production engine", invocation: "node node_modules/vitest/vitest.mjs run app/games/_games/capybara-defense/balance-simulation.test.ts", rules: RULES, seeds: SIMULATION_SEEDS, summaries, results }, null, 2));
    console.log(JSON.stringify(summaries));
    const expectedKills = Array.from({ length: 120 }, (_, index) => getWaveInfo(index + 1).count).reduce((total, count) => total + count, 0);
    for (const policy of ["balanced", "ranged", "no-apocalypse"]) {
      const runs = results.filter(result => result.policy === policy);
      expect(runs.filter(result => result.phase === "won").length).toBeGreaterThanOrEqual(12);
      for (const run of runs.filter(result => result.phase === "won")) {
        expect(run.kills).toBe(expectedKills);
        expect(run.bosses).toHaveLength(15);
        expect(run.bosses.every(boss => boss.defeatedMs !== null)).toBe(true);
        expect(run).toMatchObject({ finalRound: 120, finalSpawned: 9, finalBossDefeated: true, remainingEnemies: 0 });
        expect(run.economy.at(-1)?.round).toBe(120);
      }
    }
    expect(results.filter(result => result.policy === "no-spend").every(result => result.phase === "lost")).toBe(true);
    expect(results.filter(result => result.policy === "no-upgrades" && result.phase === "lost").length).toBeGreaterThanOrEqual(12);
    expect(results.filter(result => result.policy === "no-apocalypse").every(result => result.maxApocalypseDeployed === 0)).toBe(true);
    expect(results.filter(result => result.policy === "balanced").every(result => result.collections.some(collection => collection.id === "epic-team" && collection.round < 120))).toBe(true);
    for (const run of results.filter(result => result.policy === "balanced" && result.phase === "won")) {
      expect(run.populationByQuarter[3]).toBeGreaterThanOrEqual(run.populationByQuarter[0] * 3);
      const firstBoss = run.bosses[0], lastBoss = run.bosses.at(-1);
      expect(lastBoss?.defeatedMs).not.toBeNull();
      if (lastBoss?.defeatedMs && firstBoss.defeatedMs) {
        expect(lastBoss.defeatedMs - lastBoss.appearedMs).toBeGreaterThan(10_000);
        expect(lastBoss.defeatedMs - lastBoss.appearedMs).toBeGreaterThan((firstBoss.defeatedMs - firstBoss.appearedMs) * 3);
      }
    }
  }, 120_000);
});
