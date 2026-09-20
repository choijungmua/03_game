"use client";

import { type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";

import { Dialog } from "@/components/overlay/dialog";
import { Button } from "@/components/ui/button";

import { resolveAttack } from "./combat";
import type { CombatState } from "./combat";
import { CLASS_WEIGHTS, DEFENSE_RULES, EQUIPMENT_RARITY_WEIGHTS, EQUIPMENT_SLOTS, EQUIPMENT_SLOT_WEIGHTS, GACHA_WEIGHTS, getRoundConfig, HERO_CLASSES, HERO_TIERS, SKILLS } from "./constants";
import { collectEquipment, compareEquipment, createEmptyInventory, createEmptyLoadout, equipEquipment, rollEquipmentDrop } from "./equipment";
import type { EquipmentState } from "./equipment-types";
import { createHeroInventory, drawHero, purchaseHeroUpgrade } from "./heroes";
import { acquireMonster, activeMonsterCount, advanceDefenseEngine, createDefenseEngine, setDefenseClockSpeed } from "./logic";
import { damageMonster, getNextWavePreview, getPopulationAlert } from "./monsters";
import { clearDefenseSave, readDefenseSave, shouldAutosaveRound, writeDefenseSave } from "./persistence";
import type { DefenseCheckpoint } from "./persistence";
import { changeTargetPriority, confirmPlacementMerge, createPlacementState, PLACEMENT_ZONES, previewPlacementMerge, sellPlacedUnit, undoPlacementMerge } from "./placement";
import type { PlacementMergeUndo, PlacementState } from "./placement";
import { DEFENSE_ARENA_HEIGHT, DEFENSE_ARENA_WIDTH, getClassAttackPresentation, getMonsterRenderPoint, getUnitRenderPoint, renderDefenseFrame, validateUnitPlacement } from "./renderer";
import type { UnitPlacementPoint } from "./renderer";
import { aggregateDefenseResults } from "./results";
import type { DefenseCombatEvent } from "./results";
import { DEFAULT_DEFENSE_SETTINGS, readDefenseSettings, writeDefenseSettings } from "./settings";
import type { DefenseSettings } from "./settings";
import { beginSkillTargeting, confirmSkillCast, createSkillState, SKILL_IDS } from "./skills";
import type { SkillEffect, SkillEnemy, SkillTarget } from "./skills";
import { advanceTutorial, createTutorialState, readDefenseTutorial, skipTutorial, writeDefenseTutorial } from "./tutorial";
import type { TutorialState, TutorialStep } from "./tutorial";
import type { DefenseEngine, DefensePhase, EquipmentSlot, HeroClass, HeroInventory, HeroTier, TargetPriority } from "./types";

import styles from "./capybara-defense.module.css";

const MAPS = [
  { id: "reed-marsh", name: "갈대 습지", detail: "느려지는 물길을 따라 방어해요." },
  { id: "hot-spring", name: "온천 계곡", detail: "마나 샘을 활용해 스킬을 자주 써요." },
  { id: "moonlit-orchard", name: "달빛 과수원", detail: "치명타 숲의 긴 갈림길을 지켜요." },
] as const;
const CLASS_NAMES: Readonly<Record<HeroClass, string>> = { warrior: "전사", archer: "궁수", rogue: "도적", mage: "마법사" };
function equipmentLabel(id: string): string {
  if (id.includes("reed-bow")) return "갈대 활";
  if (id.includes("moss-armor")) return "이끼 갑옷";
  if (id.includes("spring")) return "온천 부적";
  if (id.includes("moon")) return "달빛 장비";
  return "카피바라 장비";
}

const RARITY_NAMES: Readonly<Record<HeroTier, string>> = { common: "일반", rare: "희귀", epic: "영웅", legendary: "전설", mythic: "신화", primordial: "태초" };
const EQUIPMENT_SLOT_NAMES: Readonly<Record<EquipmentSlot, string>> = { weapon: "무기", armor: "갑옷", accessory: "장신구" };
const WAVE_TRAIT_NAMES: Readonly<Record<string, string>> = { splitting: "분열", swift: "신속", shielded: "보호막", armored: "중장갑", swarm: "무리" };
const TUTORIAL_NAMES: Readonly<Record<TutorialStep, string>> = { draw: "뽑기", place: "배치", merge: "합성", upgrade: "강화" };

type TimedCombatEffects = {
  warCry: { until: number; attackMultiplier: number; attackSpeedMultiplier: number } | null;
  focusedShot: { until: number; damageMultiplier: number } | null;
  armorBreak: Record<string, { until: number; reduction: number }>;
  weakPoint: Record<string, { until: number; damageMultiplier: number }>;
  slows: Record<string, { until: number; multiplier: number }>;
};

function createTimedCombatEffects(): TimedCombatEffects {
  return { warCry: null, focusedShot: null, armorBreak: {}, weakPoint: {}, slows: {} };
}

function monsterPosition(engine: DefenseEngine, progress: number): { x: number; y: number } {
  const [x, y] = getMonsterRenderPoint(engine.map.id, progress / engine.map.pathLength);
  return { x: x * DEFENSE_ARENA_WIDTH, y: y * DEFENSE_ARENA_HEIGHT };
}
const SKILL_NAMES = ["함성", "방어 파괴", "화살비", "집중 사격", "연쇄 표창", "약점 포착", "속박장", "별똥별"] as const;
const PANELS = ["영웅", "장비", "강화"] as const;
type PanelName = (typeof PANELS)[number];
type ScreenPhase = "idle" | DefensePhase;
type PlacedUnits = Readonly<Record<number, number>>;
type CapybaraDefenseProps = Readonly<{ random?: () => number }>;

function randomMapIndex(random: () => number): number {
  return Math.min(MAPS.length - 1, Math.floor(Math.max(0, random()) * MAPS.length));
}

function secondsLeft(engine: DefenseEngine, phase: DefensePhase): number {
  const duration = phase === "combat" ? DEFENSE_RULES.combatMs : DEFENSE_RULES.preparationMs;
  return Math.max(0, Math.ceil((duration - engine.phaseElapsedMs) / 1_000));
}

export function CapybaraDefense({ random = Math.random }: CapybaraDefenseProps) {
  const [mapIndex, setMapIndex] = useState(() => randomMapIndex(random));
  const [phase, setPhase] = useState<ScreenPhase>("preparation");
  const [inventory, setInventory] = useState<HeroInventory>(() => createHeroInventory());
  const [panel, setPanel] = useState<PanelName>("영웅");
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  const [placed, setPlaced] = useState<PlacedUnits>({});
  const [feedback, setFeedback] = useState("지도를 고르고 방어를 시작하세요.");
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [skillState, setSkillState] = useState(() => createSkillState(100, 65));
  const [skillClock, setSkillClock] = useState(0);
  const [targetPriorities, setTargetPriorities] = useState<Readonly<Record<string, TargetPriority>>>({});
  const [investedCosts, setInvestedCosts] = useState<Readonly<Record<string, number>>>({});
  const [unitRanges, setUnitRanges] = useState<Readonly<Record<string, number>>>({});
  const [mergeUndo, setMergeUndo] = useState<PlacementMergeUndo | null>(null);
  const [equipmentState, setEquipmentState] = useState<EquipmentState>(() => ({ inventory: createEmptyInventory(), loadout: createEmptyLoadout() }));
  const [unitPositions, setUnitPositions] = useState<Readonly<Record<string, UnitPlacementPoint>>>({});
  const [draggingUnit, setDraggingUnit] = useState<number | null>(null);
  const [placementGhost, setPlacementGhost] = useState<(UnitPlacementPoint & { valid: boolean }) | null>(null);
  const [managementOpen, setManagementOpen] = useState(true);
  const [attackCue, setAttackCue] = useState("전투 효과 대기");
  const [attackEffect, setAttackEffect] = useState<{ heroClass: HeroClass; position: readonly [number, number] } | null>(null);
  const [reducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  const [combatEvents, setCombatEvents] = useState<readonly DefenseCombatEvent[]>([]);
  const [settings, setSettings] = useState<DefenseSettings>(DEFAULT_DEFENSE_SETTINGS);
  const [tutorial, setTutorial] = useState<TutorialState>(() => createTutorialState());
  const [resume, setResume] = useState<DefenseCheckpoint | null>(null);
  const [recovery, setRecovery] = useState("");
  const [fixtureCount, setFixtureCount] = useState<number | null>(null);
  const [hud, setHud] = useState({ lives: 20, round: 1, liveCount: 0, remaining: 50 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DefenseEngine | null>(null);
  const lastFrame = useRef(0);
  const lastAttack = useRef(0);
  const combatStates = useRef<Readonly<Record<string, CombatState>>>({});
  const timedCombatEffects = useRef<TimedCombatEffects>(createTimedCombatEffects());
  const map = MAPS[mapIndex];
  const mana = skillState.mana.current;
  const targeting = skillState.targeting !== null;
  const { liveCount, round } = hud;
  const displayedCount = fixtureCount ?? liveCount;
  const population = getPopulationAlert(displayedCount);
  const preview = getNextWavePreview(round);
  const slots = useMemo(() => PLACEMENT_ZONES[map.id].filter((zone) => zone.kind === "slot"), [map.id]);
  const resultStats = aggregateDefenseResults(combatEvents);

  useEffect(() => {
    if (engineRef.current !== null) return;
    engineRef.current = createDefenseEngine(map.id);
    setFeedback(`${map.name} 준비: 영웅 뽑기 → 영웅을 끌기/선택 → 경기장 빈 곳에 놓기`);
  }, [map.id, map.name]);

  const renderUnits = useMemo(() => Object.entries(placed).flatMap(([slot, unitIndex]) => {
    const unit = inventory.units[unitIndex];
    const position = unit === undefined ? undefined : unitPositions[unit.id];
    return unit === undefined ? [] : [{ heroClass: unit.heroClass, slot: Number(slot), selected: selectedUnit === unitIndex, ...(position === undefined ? {} : { position: [position.x, position.y] as const }) }];
  }), [inventory.units, placed, selectedUnit, unitPositions]);

  function placementState(): PlacementState {
    return createPlacementState(map.id, inventory.units.map((unit, index) => ({
      unitId: unit.id,
      slotId: slots[Number(Object.entries(placed).find(([, placedIndex]) => placedIndex === index)?.[0] ?? -1)]?.id ?? null,
      priority: targetPriorities[unit.id] ?? "first",
      range: unitRanges[unit.id] ?? 160,
      investedCost: investedCosts[unit.id] ?? DEFENSE_RULES.drawCost,
    })), inventory.economy.money);
  }

  function placedFromState(nextInventory: HeroInventory, nextPlacement: PlacementState): PlacedUnits {
    return Object.fromEntries(nextPlacement.units.flatMap((unit) => {
      if (unit.slotId === null) return [];
      const slotIndex = slots.findIndex((slot) => slot.id === unit.slotId);
      const unitIndex = nextInventory.units.findIndex((hero) => hero.id === unit.unitId);
      return slotIndex < 0 || unitIndex < 0 ? [] : [[slotIndex, unitIndex]];
    }));
  }

  function skillEnemies(): readonly SkillEnemy[] {
    const engine = engineRef.current;
    if (engine === null) return [];
    const config = getRoundConfig(engine.round);
    return engine.monsters.filter((monster) => monster.active).map((monster) => {
      const armorBreak = timedCombatEffects.current.armorBreak[monster.id.toString()];
      return {
        id: monster.id.toString(),
        position: monsterPosition(engine, monster.progress),
        boss: monster.kind === "boss",
        armor: Math.max(0, config.armor - (armorBreak !== undefined && armorBreak.until > engine.totalElapsedMs ? armorBreak.reduction : 0)),
        shield: monster.shield,
        health: monster.health,
      };
    });
  }

  useEffect(() => {
    if (!settings.bgm || phase === "idle" || phase === "result" || window.AudioContext === undefined) return;
    const context = new AudioContext();
    const tone = context.createOscillator();
    const gain = context.createGain();
    tone.type = "sine";
    tone.frequency.value = 146;
    gain.gain.value = 0.012;
    tone.connect(gain).connect(context.destination);
    tone.start();
    return () => { tone.stop(); void context.close(); };
  }, [phase, settings.bgm]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSettings(readDefenseSettings(window.localStorage));
      setTutorial(readDefenseTutorial(window.localStorage));
      const saved = readDefenseSave(window.localStorage);
      if (saved.kind === "resume") setResume(saved.checkpoint);
      if (saved.kind === "discarded") setRecovery("저장 데이터를 복구할 수 없어 새 게임으로 시작합니다.");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const fixture = new URLSearchParams(window.location.search).get("defenseFixture");
    const fixtureRound = fixture === "boss" ? 10 : fixture === "dense" ? 55 : fixture === "result" ? 100 : null;
    if (fixtureRound === null) return;
    const timeout = window.setTimeout(() => {
      const fixtureEngine = createDefenseEngine(map.id, fixtureRound);
      if (fixture === "result") { fixtureEngine.phase = "result"; fixtureEngine.outcome = "clear"; }
      if (fixture !== "result") {
        const config = getRoundConfig(fixtureRound);
        const count = fixture === "dense" ? 120 : 1;
        for (let index = 0; index < count; index += 1) {
          const monster = acquireMonster(fixtureEngine, config, index % config.spawnCount);
          monster.progress = fixtureEngine.map.pathLength * ((index + 0.5) / count);
          monster.baseSpeed = 0;
          monster.targetSpeed = 0;
          monster.speed = 0;
        }
        fixtureEngine.spawnIndex = config.spawnCount;
        fixtureEngine.phase = "combat";
      }
      engineRef.current = fixtureEngine;
      setFixtureCount(fixture === "dense" ? 120 : fixture === "boss" ? 1 : 0);
      setHud({ lives: 12, round: fixtureRound, liveCount: 0, remaining: fixture === "result" ? 0 : 32 });
      setPhase(fixture === "result" ? "result" : "combat");
      setFeedback(fixture === "dense" ? "몬스터 120마리: 매우 위험 단계입니다." : "검증 장면을 불러왔습니다.");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [map.id]);

  useEffect(() => {
    if (phase !== "preparation" || !shouldAutosaveRound(round) || engineRef.current === null) return;
    writeDefenseSave(window.localStorage, {
      mapId: map.id, round, phase: "preparation", lives: hud.lives, mana, heroInventory: inventory,
      placement: createPlacementState(map.id, inventory.units.map((unit, index) => ({
        unitId: unit.id, slotId: slots[Number(Object.entries(placed).find(([, unitIndex]) => unitIndex === index)?.[0] ?? -1)]?.id ?? null,
        priority: targetPriorities[unit.id] ?? "first", range: unitRanges[unit.id] ?? 160, investedCost: investedCosts[unit.id] ?? DEFENSE_RULES.drawCost,
      })), inventory.economy.money),
      equipment: equipmentState,
    });
  }, [equipmentState, hud.lives, inventory, investedCosts, mana, map.id, phase, placed, round, slots, targetPriorities, unitRanges]);

  useEffect(() => {
    if (phase === "idle" || engineRef.current === null) return;
    let frame = 0;
    const update = (time: number) => {
      const current = engineRef.current;
      if (current === null) return;
      if (phase === "combat" && lastFrame.current > 0) {
        const elapsed = Math.min(time - lastFrame.current, 250);
        advanceDefenseEngine(current, targeting ? elapsed * 0.35 : elapsed);
      }
      const effects = timedCombatEffects.current;
      if (effects.warCry !== null && effects.warCry.until <= current.totalElapsedMs) effects.warCry = null;
      if (effects.focusedShot !== null && effects.focusedShot.until <= current.totalElapsedMs) effects.focusedShot = null;
      for (const monster of current.monsters.filter((candidate) => candidate.active)) {
        const slow = effects.slows[monster.id.toString()];
        if (slow !== undefined && slow.until > current.totalElapsedMs) {
          monster.targetSpeed = monster.baseSpeed * slow.multiplier;
          monster.speed = Math.min(monster.speed, monster.baseSpeed * slow.multiplier);
        } else if (slow !== undefined) {
          delete effects.slows[monster.id.toString()];
          monster.targetSpeed = monster.baseSpeed;
        }
      }
      const warCry = effects.warCry !== null && effects.warCry.until > current.totalElapsedMs ? effects.warCry : null;
      const attackInterval = 750 / (warCry?.attackSpeedMultiplier ?? 1);
      if (phase === "combat" && time - lastAttack.current >= attackInterval) {
        lastAttack.current = time;
        const roundConfig = getRoundConfig(current.round);
        const targets = current.monsters.filter((monster) => monster.active).map((monster) => {
          const armorBreak = effects.armorBreak[monster.id.toString()];
          return {
            id: monster.id.toString(), position: monsterPosition(current, monster.progress), progress: monster.progress,
            health: monster.health, maxHealth: monster.maxHealth,
            armor: Math.max(0, roundConfig.armor - (armorBreak !== undefined && armorBreak.until > current.totalElapsedMs ? armorBreak.reduction : 0)),
            boss: monster.kind === "boss", active: monster.active,
          };
        });
        Object.entries(placed).forEach(([slotIndexText, unitIndex]) => {
          const slotIndex = Number(slotIndexText);
        const unit = inventory.units[unitIndex];
        if (unit === undefined) return;
        const [unitX, unitY] = getUnitRenderPoint(slotIndex);
        const customPosition = unitPositions[unit.id];
        const position = {
          x: (customPosition?.x ?? unitX) * DEFENSE_ARENA_WIDTH,
          y: (customPosition?.y ?? unitY) * DEFENSE_ARENA_HEIGHT,
        };
          const equippedAttackBonus = Object.values(equipmentState.loadout).reduce((sum, item) => sum + (item?.requiredClass === unit.heroClass ? item.effect.attackBonus : 0), 0);
          const prior = combatStates.current[unit.id] ?? { warriorTargetId: null, warriorRampHits: 0 };
          const attack = resolveAttack({
          id: unit.id, heroClass: unit.heroClass, tier: unit.tier, position, priority: targetPriorities[unit.id] ?? "first",
            classUpgradeLevel: inventory.economy.classUpgradeLevels[unit.heroClass],
            tierUpgradeLevel: inventory.economy.tierUpgradeLevels[unit.tier],
            equipmentAttackBonus: unit.stats.attackBonus + equippedAttackBonus, criticalChance: 0.1,
          }, targets, prior, { criticalRoll: Math.random(), damageNumbers: settings.damageNumbers });
          combatStates.current = { ...combatStates.current, [unit.id]: attack.state };
          let total = 0;
          const defeated: DefenseCombatEvent[] = [];
          for (const hit of attack.hits) {
            const monster = current.monsters.find((candidate) => candidate.id.toString() === hit.targetId && candidate.active);
            if (monster === undefined) continue;
            const weakPoint = effects.weakPoint[hit.targetId];
            const focusedShot = effects.focusedShot !== null && effects.focusedShot.until > current.totalElapsedMs && unit.heroClass === "archer" ? effects.focusedShot : null;
            const amount = hit.damage * (warCry?.attackMultiplier ?? 1) * (focusedShot?.damageMultiplier ?? 1) * (weakPoint !== undefined && weakPoint.until > current.totalElapsedMs ? weakPoint.damageMultiplier : 1);
            total += amount;
            damageMonster(monster, { amount, kind: "normal" });
            if (!monster.active) {
              defeated.push({ kind: "kill", unitId: unit.id });
              const drop = rollEquipmentDrop({ id: `equipment-${current.round}-${monster.id}`, enemyKind: monster.kind === "boss" ? "boss" : "normal", round: current.round, random: Math.random });
              if (drop !== null) {
                setEquipmentState((state) => {
                  const collected = collectEquipment({ drop, currentRound: current.round, inventory: state.inventory });
                  return collected.kind === "collected" ? { ...state, inventory: collected.inventory } : state;
                });
                setFeedback(`${equipmentLabel(drop.item.id)} 장비를 획득했습니다.`);
              }
            }
          }
        const damageEvent: DefenseCombatEvent = { kind: "damage", heroClass: unit.heroClass, unitId: unit.id, amount: total };
        if (attack.kind === "hit") {
          setCombatEvents((events) => [...events, damageEvent, ...defeated]);
          const presentation = getClassAttackPresentation(unit.heroClass);
          setAttackCue(presentation.cue);
          setAttackEffect({ heroClass: unit.heroClass, position: [position.x / DEFENSE_ARENA_WIDTH, position.y / DEFENSE_ARENA_HEIGHT] });
        }
        });
      }
      lastFrame.current = time;
      if (current.phase === "result" && phase !== "result") {
        setPhase("result");
        if (current.leakCount > 0) setCombatEvents((events) => [...events, { kind: "leak", count: current.leakCount }]);
      }
      else if (phase === "combat" && current.phase === "preparation") setPhase("preparation");
      setHud({ lives: current.lives, round: current.round, liveCount: activeMonsterCount(current), remaining: secondsLeft(current, current.phase) });
      setSkillClock(time);
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [equipmentState.loadout, inventory, phase, placed, settings.damageNumbers, targetPriorities, targeting, unitPositions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || phase === "idle") return;
    const engine = engineRef.current;
    const monsters = engine?.monsters.filter((monster) => monster.active).map((monster) => ({
      progress: monster.progress / engine.map.pathLength,
      health: monster.health,
      maxHealth: monster.maxHealth,
      boss: monster.kind === "boss",
    })) ?? [];
    renderDefenseFrame(canvas, {
      mapId: map.id, round, monsters, units: renderUnits, damageNumbers: settings.damageNumbers, screenShake: settings.screenShake,
      reducedMotion: window.matchMedia === undefined ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches, targeting,
      attackEffects: attackEffect === null ? [] : [attackEffect],
    });
  }, [attackEffect, displayedCount, map.id, phase, renderUnits, round, settings.damageNumbers, settings.screenShake, targeting]);

  function startGame(): void {
    const nextMapIndex = randomMapIndex(random);
    const nextMap = MAPS[nextMapIndex];
    setMapIndex(nextMapIndex);
    engineRef.current = createDefenseEngine(nextMap.id);
    setHud({ lives: 20, round: 1, liveCount: 0, remaining: 10 });
    setInventory(createHeroInventory());
    setEquipmentState({ inventory: createEmptyInventory(), loadout: createEmptyLoadout() });
    setUnitPositions({});
    setSkillState(createSkillState(100, 65));
    setTargetPriorities({});
    setInvestedCosts({});
    setUnitRanges({});
    setMergeUndo(null);
    timedCombatEffects.current = createTimedCombatEffects();
    setCombatEvents([]);
    setPlaced({});
    setPhase("preparation");
    setFeedback(`${nextMap.name} 준비: 영웅 뽑기 → 영웅을 끌기/선택 → 경기장 빈 곳에 놓기`);
  }

  function resumeGame(checkpoint: DefenseCheckpoint): void {
    const nextEngine = createDefenseEngine(checkpoint.mapId, checkpoint.round);
    nextEngine.lives = checkpoint.lives;
    nextEngine.phase = "preparation";
    nextEngine.phaseElapsedMs = 0;
    engineRef.current = nextEngine;
    setMapIndex(MAPS.findIndex((candidate) => candidate.id === checkpoint.mapId));
    setInventory(checkpoint.heroInventory);
    setEquipmentState(checkpoint.equipment);
    setUnitPositions({});
    setPlaced(Object.fromEntries(checkpoint.placement.units.flatMap((unit) => {
      const slotIndex = PLACEMENT_ZONES[checkpoint.mapId].findIndex((slot) => slot.id === unit.slotId);
      const unitIndex = checkpoint.heroInventory.units.findIndex((hero) => hero.id === unit.unitId);
      return slotIndex < 0 || unitIndex < 0 ? [] : [[slotIndex, unitIndex]];
    })));
    setSkillState(createSkillState(100, checkpoint.mana));
    setTargetPriorities(Object.fromEntries(checkpoint.placement.units.map((unit) => [unit.unitId, unit.priority])));
    setInvestedCosts(Object.fromEntries(checkpoint.placement.units.map((unit) => [unit.unitId, unit.investedCost])));
    setUnitRanges(Object.fromEntries(checkpoint.placement.units.map((unit) => [unit.unitId, unit.range])));
    setMergeUndo(null);
    timedCombatEffects.current = createTimedCombatEffects();
    setHud({ lives: checkpoint.lives, round: checkpoint.round, liveCount: 0, remaining: 10 });
    setPhase("preparation");
    setFeedback(`${checkpoint.round}라운드 준비 상태를 불러왔습니다.`);
  }

  function completeTutorialStep(step: TutorialStep): void {
    const next = advanceTutorial(tutorial, step);
    setTutorial(next);
    writeDefenseTutorial(window.localStorage, next);
  }

  function toggleSetting(key: keyof DefenseSettings): void {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    writeDefenseSettings(window.localStorage, next);
  }

  function playSfx(frequency: number): void {
    if (!settings.sfx || window.AudioContext === undefined) return;
    const context = new AudioContext();
    const tone = context.createOscillator();
    const gain = context.createGain();
    tone.frequency.value = frequency;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
    tone.connect(gain).connect(context.destination);
    tone.start();
    tone.stop(context.currentTime + 0.08);
    tone.addEventListener("ended", () => { void context.close(); }, { once: true });
  }

  function startCombat(): void {
    setManagementOpen(false);
    setPhase("combat");
    setFeedback(`${round}라운드 전투를 시작합니다.`);
  }

  function handleDraw(): void {
    const result = drawHero(inventory, random);
    if (!result.ok) { setFeedback(result.reason === "insufficient-currency" ? "도토리가 부족합니다. 다음 라운드 보상을 기다리거나 영웅을 판매하세요." : "영웅 보관함이 가득 찼습니다. 합성하거나 판매하세요."); return; }
    setInventory(result.state);
    setSelectedUnit(result.state.units.length - 1);
    setManagementOpen(true);
    setFeedback(`${CLASS_NAMES[result.unit.heroClass]} 영웅을 뽑았습니다. 영웅을 끌거나 선택한 뒤 경기장 빈 곳에 놓으세요.`);
    playSfx(420);
    completeTutorialStep("draw");
  }

  function placeUnit(slotIndex: number): void {
    if (selectedUnit === null) { setFeedback("먼저 영웅을 선택하세요."); return; }
    if (Object.values(placed).includes(selectedUnit)) setFeedback("이 영웅을 새 칸으로 이동합니다.");
    setPlaced((current) => Object.fromEntries([
      ...Object.entries(current).filter(([slot, unitIndex]) => Number(slot) !== slotIndex && unitIndex !== selectedUnit),
      [slotIndex, selectedUnit],
    ]));
    setFeedback(`영웅을 빈 배치 칸 ${slotIndex + 1}에 배치했습니다.`);
    playSfx(520);
    completeTutorialStep("place");
  }

  function placeSelectedAt(point: UnitPlacementPoint): void {
    if (selectedUnit === null) { setFeedback("영웅을 먼저 끌거나 선택하세요."); return; }
    const unit = inventory.units[selectedUnit];
    if (unit === undefined) return;
    const occupied = Object.entries(unitPositions).flatMap(([unitId, position]) => unitId === unit.id ? [] : [position]);
    const validation = validateUnitPlacement(point, occupied);
    setPlacementGhost({ ...point, valid: validation.kind === "valid" });
    if (validation.kind === "invalid") { setFeedback(validation.reason); return; }
    const currentSlot = Number(Object.entries(placed).find(([, unitIndex]) => unitIndex === selectedUnit)?.[0] ?? -1);
    const openSlot = slots.findIndex((_, slotIndex) => placed[slotIndex] === undefined);
    const slotIndex = currentSlot >= 0 ? currentSlot : openSlot;
    if (slotIndex < 0) { setFeedback("배치 공간이 가득 찼습니다. 영웅을 판매하거나 합성하세요."); return; }
    placeUnit(slotIndex);
    setUnitPositions((current) => ({ ...current, [unit.id]: point }));
    setPlacementGhost(null);
    setFeedback(`${CLASS_NAMES[unit.heroClass]} 영웅을 경기장 빈 곳에 배치했습니다.`);
  }

  function pointerPoint(clientX: number, clientY: number): UnitPlacementPoint {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect === undefined || rect.width === 0 || rect.height === 0) return { x: -1, y: -1 };
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  }

  function beginHeroDrag(event: ReactPointerEvent<HTMLButtonElement>, unitIndex: number): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedUnit(unitIndex);
    setDraggingUnit(unitIndex);
    setFeedback("영웅을 경기장 빈 곳으로 끌어 놓으세요.");
  }

  function moveHeroDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (draggingUnit === null) return;
    const point = pointerPoint(event.clientX, event.clientY);
    const validation = validateUnitPlacement(point, Object.values(unitPositions));
    setPlacementGhost({ ...point, valid: validation.kind === "valid" });
  }

  function finishHeroDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (draggingUnit === null) return;
    placeSelectedAt(pointerPoint(event.clientX, event.clientY));
    setDraggingUnit(null);
  }

  function upgradeWarrior(): void {
    const result = purchaseHeroUpgrade(inventory, { kind: "class", heroClass: "warrior" });
    if (result.kind !== "purchased") { setFeedback(result.message); return; }
    setInventory(result.state);
    setFeedback("전사 공격력을 강화했습니다. 강화 효과음이 재생됩니다.");
    playSfx(680);
    completeTutorialStep("upgrade");
  }

  function applySkillEffect(effect: SkillEffect): void {
    const engine = engineRef.current;
    if (engine === null) return;
    const hit = (id: string, amount: number, kind: "normal" | "shield-break" = "normal") => {
      const monster = engine.monsters.find((candidate) => candidate.active && candidate.id.toString() === id);
      if (monster !== undefined) damageMonster(monster, { amount, kind });
    };
    if (effect.kind === "arrow-rain") effect.targetIds.forEach((id) => hit(id, effect.volleys * effect.damagePerVolley));
    if (effect.kind === "chain-shuriken") effect.targetIds.forEach((id, index) => hit(id, effect.damages[index] ?? 0));
    if (effect.kind === "meteor") effect.targets.forEach((target) => hit(target.id, target.damage + target.shieldDamage, "shield-break"));
    if (effect.kind === "war-cry") timedCombatEffects.current.warCry = { until: engine.totalElapsedMs + effect.durationMs, attackMultiplier: effect.attackMultiplier, attackSpeedMultiplier: effect.attackSpeedMultiplier };
    if (effect.kind === "focused-shot") timedCombatEffects.current.focusedShot = { until: engine.totalElapsedMs + effect.durationMs, damageMultiplier: 1 + effect.projectileBonus };
    if (effect.kind === "armor-break") effect.targets.forEach((target) => {
      hit(target.id, target.shieldDamage, "shield-break");
      timedCombatEffects.current.armorBreak[target.id] = { until: engine.totalElapsedMs + effect.durationMs, reduction: target.armorReduction };
    });
    if (effect.kind === "weak-point") timedCombatEffects.current.weakPoint[effect.targetId] = { until: engine.totalElapsedMs + effect.durationMs, damageMultiplier: effect.damageTakenMultiplier };
    if (effect.kind === "binding-field") effect.targets.forEach((target) => {
      timedCombatEffects.current.slows[target.id] = { until: engine.totalElapsedMs + effect.durationMs, multiplier: target.speedMultiplier };
    });
  }

  function finishSkill(target: SkillTarget, nowMs: number): void {
    const result = confirmSkillCast(skillState, { target, enemies: skillEnemies(), nowMs });
    if (result.kind !== "cast") { setFeedback("선택한 위치에는 스킬을 사용할 수 없습니다."); return; }
    applySkillEffect(result.effect);
    setSkillState(result.state);
    setFeedback(`${SKILL_NAMES[SKILL_IDS.indexOf(result.effect.kind)] ?? "스킬"}을 사용했습니다.`);
    playSfx(760);
  }

  function castSkill(index: number, nowMs: number): void {
    const skillId = SKILL_IDS[index];
    if (skillId === undefined) return;
    const result = beginSkillTargeting(skillState, {
      skillId,
      roster: inventory.units.map((unit) => ({ heroClass: unit.heroClass, tier: unit.tier })),
      upgradeLevel: inventory.economy.classUpgradeLevels[skillId === "war-cry" || skillId === "armor-break" ? "warrior" : skillId === "arrow-rain" || skillId === "focused-shot" ? "archer" : skillId === "chain-shuriken" || skillId === "weak-point" ? "rogue" : "mage"],
      effectMultiplier: 1,
      cooldownMultiplier: 1,
      clockSpeed: speed,
      origin: { x: DEFENSE_ARENA_WIDTH / 2, y: DEFENSE_ARENA_HEIGHT / 2 },
      nowMs,
    });
    if (result.kind === "locked") { setFeedback("해당 직업 영웅을 먼저 뽑아야 합니다."); return; }
    if (result.kind === "cooldown") { setFeedback(`재사용까지 ${Math.ceil(result.remainingMs / 1_000)}초 남았습니다.`); return; }
    if (result.kind === "insufficient-mana") { setFeedback(`마나가 ${result.requiredMana - result.currentMana} 부족합니다.`); return; }
    setSkillState(result.state);
    if (result.preview.targetKind === "self") {
      const cast = confirmSkillCast(result.state, { target: { kind: "self" }, enemies: skillEnemies(), nowMs });
      if (cast.kind === "cast") { applySkillEffect(cast.effect); setSkillState(cast.state); playSfx(760); setFeedback(`${SKILL_NAMES[index]}을 사용했습니다.`); }
      return;
    }
    setFeedback(`${SKILL_NAMES[index]} 대상을 전장에서 선택하세요. 조준 중에는 시간이 느려집니다.`);
  }

  function handleArenaTarget(event: ReactMouseEvent<HTMLCanvasElement>): void {
    const normalizedPoint = pointerPoint(event.clientX, event.clientY);
    if (phase === "preparation" && selectedUnit !== null && skillState.targeting === null) {
      placeSelectedAt(normalizedPoint);
      return;
    }
    const pending = skillState.targeting;
    if (pending === null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const position = {
      x: ((event.clientX - rect.left) / rect.width) * DEFENSE_ARENA_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * DEFENSE_ARENA_HEIGHT,
    };
    if (pending.targetKind === "point") { finishSkill({ kind: "point", position }, event.timeStamp); return; }
    const enemies = skillEnemies();
    const nearest = enemies.toSorted((left, right) => Math.hypot(left.position.x - position.x, left.position.y - position.y) - Math.hypot(right.position.x - position.x, right.position.y - position.y))[0];
    if (nearest === undefined) { setFeedback("선택할 몬스터가 없습니다."); return; }
    finishSkill({ kind: "enemy", enemyId: nearest.id }, event.timeStamp);
  }

  function handleArenaKey(event: KeyboardEvent<HTMLCanvasElement>): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    placeSelectedAt({ x: 0.5, y: 0.5 });
  }

  function sellSelected(): void {
    const unit = selectedUnit === null ? undefined : inventory.units[selectedUnit];
    if (unit === undefined) { setFeedback("판매할 영웅을 먼저 선택하세요."); return; }
    const sold = sellPlacedUnit(placementState(), unit.id);
    if (!sold.ok) { setFeedback("이 영웅은 지금 판매할 수 없습니다."); return; }
    const nextInventory: HeroInventory = { ...inventory, units: inventory.units.filter((hero) => hero.id !== unit.id), economy: { ...inventory.economy, money: sold.state.money } };
    setInventory(nextInventory);
    setPlaced(placedFromState(nextInventory, sold.state));
    setInvestedCosts(Object.fromEntries(sold.state.units.map((managed) => [managed.unitId, managed.investedCost])));
    setUnitRanges(Object.fromEntries(sold.state.units.map((managed) => [managed.unitId, managed.range])));
    setSelectedUnit(null);
    setUnitPositions((current) => Object.fromEntries(Object.entries(current).filter(([unitId]) => unitId !== unit.id)));
    setFeedback(`${sold.refund} 도토리를 돌려받았습니다.`);
  }

  function mergeOrUndo(): void {
    const current = placementState();
    if (mergeUndo !== null) {
      const undone = undoPlacementMerge(current, inventory, mergeUndo, Date.now());
      if (!undone.ok) { setFeedback("되돌릴 수 있는 시간이 지났습니다."); setMergeUndo(null); return; }
      setInventory(undone.inventory); setPlaced(placedFromState(undone.inventory, undone.placement)); setInvestedCosts(Object.fromEntries(undone.placement.units.map((unit) => [unit.unitId, unit.investedCost]))); setUnitRanges(Object.fromEntries(undone.placement.units.map((unit) => [unit.unitId, unit.range]))); setMergeUndo(null); setFeedback("합성을 되돌렸습니다."); return;
    }
    const group = inventory.units.find((unit) => inventory.units.filter((candidate) => candidate.tier === unit.tier).length >= 3);
    if (group === undefined) { setFeedback("같은 등급 영웅 3명이 필요합니다."); return; }
    const ids = inventory.units.filter((unit) => unit.tier === group.tier).slice(0, 3).map((unit) => unit.id);
    const preview = previewPlacementMerge(current, inventory, ids);
    if (!preview.ok) { setFeedback("지금은 합성할 수 없습니다."); return; }
    const merged = confirmPlacementMerge(current, inventory, preview.preview, Date.now(), Math.random);
    if (!merged.ok) { setFeedback("합성 상태가 바뀌었습니다. 다시 시도하세요."); return; }
    setInventory(merged.inventory); setPlaced(placedFromState(merged.inventory, merged.placement)); setInvestedCosts(Object.fromEntries(merged.placement.units.map((unit) => [unit.unitId, unit.investedCost]))); setUnitRanges(Object.fromEntries(merged.placement.units.map((unit) => [unit.unitId, unit.range]))); setMergeUndo(merged.undo); setSelectedUnit(null);
    setFeedback("합성했습니다. 5초 안에 다시 누르면 되돌립니다."); completeTutorialStep("merge");
  }

  function cycleTargetPriority(): void {
    const unit = selectedUnit === null ? undefined : inventory.units[selectedUnit];
    if (unit === undefined) { setFeedback("우선순위를 바꿀 영웅을 선택하세요."); return; }
    const priorities: readonly TargetPriority[] = ["first", "last", "strongest", "nearest"];
    const current = targetPriorities[unit.id] ?? "first";
    const next = priorities[(priorities.indexOf(current) + 1) % priorities.length] ?? "first";
    const changed = changeTargetPriority(placementState(), unit.id, next);
    if (!changed.ok) return;
    setTargetPriorities((values) => ({ ...values, [unit.id]: next }));
    setFeedback(`타깃 우선순위를 ${next === "first" ? "선두" : next === "last" ? "후미" : next === "strongest" ? "강한 적" : "가까운 적"}으로 바꿨습니다.`);
  }

  function equipFirstItem(): void {
    const item = equipmentState.inventory.items[0];
    if (item === undefined) { setFeedback("보관 중인 장비가 없습니다."); return; }
    const comparison = compareEquipment({ heroClass: item.requiredClass, tier: item.rarity, classUpgradeLevel: 0, tierUpgradeLevel: 0, base: { attackIntervalMs: 1_000, range: 160, maxMana: 100, skillEffect: 1, shield: 0 }, loadout: equipmentState.loadout, candidate: item });
    const equipped = equipEquipment({ ...equipmentState, heroClass: item.requiredClass, itemId: item.id });
    if (equipped.kind !== "equipped") { setFeedback("이 장비는 선택한 직업에 장착할 수 없습니다."); return; }
    setEquipmentState({ inventory: equipped.inventory, loadout: equipped.loadout });
    const attackDelta = comparison.kind === "comparison" ? Math.round(comparison.delta.attack) : 0;
    setFeedback(`${equipmentLabel(item.id)} 장착 완료 · 공격 ${attackDelta >= 0 ? "+" : ""}${attackDelta}`);
  }

  function skillCooldownLabel(id: (typeof SKILL_IDS)[number], index: number): string | number {
    const seconds = Math.max(0, Math.ceil(((skillState.cooldownReadyAt[id] ?? 0) - skillClock) / 1_000));
    return seconds > 0 ? `${seconds}초` : SKILLS[index]?.manaCost ?? 0;
  }

  const shownPhase = phase === "preparation" ? "배치 준비" : phase === "combat" ? "전투 중" : "전투 결과";
  return (
    <main className={styles.screen} data-phase={phase} data-viewport-fit="true" data-reduced-motion={String(reducedMotion)}>
      <section className={styles.shell} role="application" aria-label="카피바라 디펜스 전장">
        <div className={styles.hud} role="status" aria-label="전투 현황" data-hud="strip">{[["생명", hud.lives], ["도토리", inventory.economy.money], ["라운드", `${round} / 100`], ["남은 시간", `${hud.remaining}초`], ["마나", `${mana} / 100`], ["속도", `${speed}×`]].map(([label, value]) => <div className={styles.hudMetric} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        {phase !== "result" && round % 10 === 0 && <div className={styles.bossBar}><div className="flex justify-between"><strong>보스 · {preview?.boss?.name ?? "습지의 큰발"}</strong><span>{preview?.boss?.warningText ?? "공격 범위를 피하세요"}</span></div><div className={styles.bossTrack}><div className={styles.bossFill} /></div></div>}
        <div className={styles.gameGrid}>
          <div className={styles.arenaColumn}>
            <div className={styles.arena}>
              <canvas ref={canvasRef} tabIndex={0} aria-label={`${map.name} 전장 화면`} onClick={handleArenaTarget} onKeyDown={handleArenaKey} />
              {placementGhost !== null && <span className={styles.placementGhost} data-valid={String(placementGhost.valid)} style={{ left: `${placementGhost.x * 100}%`, top: `${placementGhost.y * 100}%` }}><span className={styles.rangePreview} /></span>}
              <span className={styles.phaseBadge} data-motion="round">{shownPhase}</span>
              <span className={styles.drawMotion} data-motion="draw" data-active={String(selectedUnit !== null)} aria-hidden="true" />
              <span className={styles.placeMotion} data-motion="place" data-active={String(Object.keys(unitPositions).length > 0)} aria-hidden="true" />
              <span className={styles.attackMotion} data-motion="attack" data-active={String(attackEffect !== null)} aria-hidden="true" />
              <span className={styles.monsterMotion} data-motion="monster" data-active={String(displayedCount > 0)} aria-hidden="true" />
            </div>
          <div className={`${styles.notice} ${population.level === "safe" ? "" : styles.warning}`}><strong>다음 웨이브 {preview?.round ?? "완료"}</strong> · {preview?.keyTraits.map((trait) => WAVE_TRAIT_NAMES[trait] ?? trait).join(" · ") ?? "마지막 라운드"}{population.level === "safe" ? null : <span className={styles.noWrap}> · {population.text}</span>}</div>
          <div className={styles.skills} aria-label="액티브 스킬">{SKILL_IDS.map((id, index) => <button key={id} type="button" className={styles.skill} aria-label={`${SKILL_NAMES[index]} 스킬, 마나 ${SKILLS[index]?.manaCost ?? 0}`} onClick={(event) => castSkill(index, event.timeStamp)}><span className={styles.skillArt} style={{ backgroundPositionX: `${-(index % 8) * 100}%` }} aria-hidden="true" /><span className={styles.skillCost}>{skillCooldownLabel(id, index)}</span></button>)}</div>
            <div className={styles.toolbar}>
              <Button className={styles.action} onClick={handleDraw}>영웅 뽑기 · 3</Button>
              <Button className={styles.action} variant="secondary" onClick={startCombat} disabled={phase !== "preparation"}>전투 시작</Button>
              <Button className={styles.action} variant="outline" onClick={() => { const next = speed === 1 ? 2 : 1; setSpeed(next); if (engineRef.current !== null) setDefenseClockSpeed(engineRef.current, next); }}>속도 {speed}×</Button>
              <Button className={styles.action} variant="outline" onClick={sellSelected}>판매</Button>
              <Button className={styles.action} variant="outline" aria-label="수비대 관리 열기" onClick={() => setManagementOpen(true)}>수비대 관리…</Button>
          <Button className={styles.action} variant="outline" onClick={mergeOrUndo}>{mergeUndo === null ? "합성" : "합성 되돌리기"}</Button>
          <Button className={styles.action} variant="outline" onClick={cycleTargetPriority}>타깃 우선순위</Button>
            </div>
            <p className={styles.notice} role="status" aria-live="polite">{feedback}</p>
            <p className="sr-only" aria-live="polite">{attackCue}</p>
          </div>
          {(managementOpen || phase === "result") && <aside className={styles.panel} role="dialog" aria-label="수비대 관리 패널">
            {phase !== "result" && <Button size="sm" variant="ghost" className={styles.panelClose} onClick={() => setManagementOpen(false)}>관리 닫기</Button>}
            <div className={styles.panelTabs}>{PANELS.map((name) => <Button key={name} type="button" size="sm" variant={panel === name ? "default" : "ghost"} aria-label={`${name} 패널 열기`} onClick={() => setPanel(name)}>{name}</Button>)}</div>
            <div className={styles.panelActions}>
              {phase === "preparation" && (
                <Dialog>
                  <Dialog.Trigger asChild><Button size="sm" variant="outline">확률 보기</Button></Dialog.Trigger>
                  <Dialog.Content showCloseButton={false} className={styles.probabilityDialog}>
                    <Dialog.Header><Dialog.Title>확률 안내</Dialog.Title><Dialog.Description>영웅, 장비, 티켓 확률을 한곳에서 확인하세요.</Dialog.Description></Dialog.Header>
                    <section className={styles.probabilitySection}><h3>영웅 등급 확률</h3><dl>{HERO_TIERS.map((tier) => <div key={tier}><dt>{RARITY_NAMES[tier]}</dt><dd>{GACHA_WEIGHTS[tier]}%</dd></div>)}</dl></section>
                    <section className={styles.probabilitySection}><h3>영웅 직업 확률</h3><dl>{HERO_CLASSES.map((heroClass) => <div key={heroClass}><dt>{CLASS_NAMES[heroClass]}</dt><dd>{CLASS_WEIGHTS[heroClass]}%</dd></div>)}</dl></section>
                    <section className={styles.probabilitySection}><h3>장비 등급 확률</h3><dl>{HERO_TIERS.map((tier) => <div key={tier}><dt>{RARITY_NAMES[tier]}</dt><dd>{EQUIPMENT_RARITY_WEIGHTS[tier]}%</dd></div>)}</dl></section>
                    <section className={styles.probabilitySection}><h3>장비 슬롯 확률</h3><dl>{EQUIPMENT_SLOTS.map((slot) => <div key={slot}><dt>{EQUIPMENT_SLOT_NAMES[slot]}</dt><dd>{EQUIPMENT_SLOT_WEIGHTS[slot]}%</dd></div>)}</dl></section>
                    <section className={styles.probabilitySection}><h3>장비 획득 확률</h3><dl><div><dt>일반 몬스터</dt><dd>{DEFENSE_RULES.normalEquipmentDropChance * 100}%</dd></div><div><dt>보스</dt><dd>확정</dd></div></dl></section>
                    <section className={styles.probabilitySection}><h3>티켓</h3><dl><div><dt>지급 주기</dt><dd>{DEFENSE_RULES.ticketEveryRounds}라운드</dd></div><div><dt>티켓 도전 성공</dt><dd>{DEFENSE_RULES.ticketChallengeSuccessChance * 100}%</dd></div></dl></section>
                    <Dialog.Footer><Dialog.Close asChild><Button>닫기</Button></Dialog.Close></Dialog.Footer>
                  </Dialog.Content>
                </Dialog>
              )}
              {resume !== null && phase === "preparation" && <Button size="sm" variant="secondary" onClick={() => resumeGame(resume)}>저장된 {resume.round}라운드 이어하기</Button>}
              {resume !== null && phase === "preparation" && <Button size="sm" variant="ghost" onClick={() => { clearDefenseSave(window.localStorage); setResume(null); }}>저장 기록 지우기</Button>}
            </div>
            {recovery !== "" && <p className={styles.notice}>{recovery}</p>}
            <h2>{panel} 관리</h2>
            {panel === "영웅" && <div className={styles.panelGrid}>{inventory.units.length === 0 ? <p className="col-span-full text-sm text-muted-foreground">영웅을 뽑으면 여기에 나타납니다.</p> : inventory.units.map((unit, index) => <button type="button" key={unit.id} className={styles.panelCard} aria-label={`${CLASS_NAMES[unit.heroClass]} 영웅 끌기 또는 선택`} aria-pressed={selectedUnit === index} data-min-target="44" onClick={() => { setSelectedUnit(index); setFeedback("선택한 영웅을 경기장 빈 곳에 놓으세요."); }} onPointerDown={(event) => beginHeroDrag(event, index)} onPointerMove={moveHeroDrag} onPointerUp={finishHeroDrag}><strong>{CLASS_NAMES[unit.heroClass]} · {RARITY_NAMES[unit.tier]}</strong><span>{Object.values(placed).includes(index) ? "배치됨 · 이동 가능" : "끌기/선택 후 놓기"}</span></button>)}</div>}
          {panel === "장비" && <div className={styles.panelGrid}><div className={styles.panelCard}><strong>{equipmentState.loadout.weapon === null ? "장착 장비 없음" : equipmentLabel(equipmentState.loadout.weapon.id)}</strong><span>공격 +{Math.round((equipmentState.loadout.weapon?.effect.attackBonus ?? 0) * 100)}%</span><Button className="mt-3 min-h-11 w-full" onClick={equipFirstItem}>비교 후 장착</Button></div>{equipmentState.inventory.items.map((item) => <div className={styles.panelCard} key={item.id}><strong>{equipmentLabel(item.id)}</strong><span>{RARITY_NAMES[item.rarity]} · {EQUIPMENT_SLOT_NAMES[item.slot]} · 보관 중</span></div>)}</div>}
            {panel === "강화" && <div className={styles.panelCard}><strong>전사 공격 훈련</strong><span>현재 +{inventory.economy.classUpgradeLevels.warrior * 10}% → 다음 +{Math.min(100, (inventory.economy.classUpgradeLevels.warrior + 1) * 10)}%</span><span>비용 4 · 부족 {Math.max(0, 4 - inventory.economy.money)}</span><Button className="mt-3 min-h-11 w-full" onClick={upgradeWarrior}>강화하기</Button></div>}
          {!tutorial.completed && <div className={`${styles.notice} mt-3`}><strong>첫 수비 안내 · {TUTORIAL_NAMES[tutorial.step]}</strong><p>뽑기 → 배치 → 합성 → 강화 순서로 익혀 보세요.</p><Button size="sm" variant="ghost" onClick={() => { const next = skipTutorial(tutorial); setTutorial(next); writeDefenseTutorial(window.localStorage, next); }}>튜토리얼 건너뛰기</Button></div>}
            <div className={`${styles.settingsGrid} mt-3`} aria-label="게임 설정">{(["bgm", "sfx", "damageNumbers", "screenShake"] as const).map((key) => <Button key={key} size="sm" variant="outline" aria-pressed={settings[key]} onClick={() => toggleSetting(key)}>{{ bgm: "배경음", sfx: "효과음", damageNumbers: "피해 숫자", screenShake: "화면 흔들림" }[key]} {settings[key] ? "켬" : "끔"}</Button>)}</div>
            {phase === "result" && <div className={`${styles.panelCard} mt-3`}><strong>전투 통계</strong><span>총 피해 {resultStats.totalDamage}</span><span>전사 피해 {resultStats.classDamage.warrior}</span><span>궁수 피해 {resultStats.classDamage.archer}</span><span>도적 피해 {resultStats.classDamage.rogue}</span><span>마법사 피해 {resultStats.classDamage.mage}</span><span>처치 {resultStats.kills} · 놓침 {resultStats.leaks}</span><span>최고 영웅 {resultStats.topUnit?.unitId ?? "없음"}</span><Button className="mt-3 w-full" onClick={startGame}>다시 도전</Button></div>}
          </aside>}
        </div>
      </section>
    </main>
  );
}
