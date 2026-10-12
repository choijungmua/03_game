import { CELLS, getUnitPoint, getUnitStats, getEnemyPoint, RULES } from "./engine";
import type { DefenseClass, DefenseState, DefenseUnit } from "./engine";
import { CAPYBARA_SPRITE, getDefenderVisual } from "./defense-visuals";

const ART = {
  forest: "#152820", meadow: "#294637", grass: "#385741", stone: "#827b61", stoneLight: "#aaa181",
  earth: "#514a39", fur: "#b47d50", furLight: "#d9ad78", muzzle: "#ebc494", ink: "#302b23", cream: "#fff1ca",
  warrior: "#e6bd79", archer: "#8fc9a0", mage: "#bfa4ec", common: "#ddd7bb", rare: "#80c4e4", epic: "#c5a0ee", legendary: "#f7cc71",
  ancient: "#8fc9a0", relic: "#e6bd79", saga: "#bfa4ec", mythic: "#835883", primordial: "#fff1ca", apocalypse: "#b87967",
  plum: "#835883", moss: "#78966c", rust: "#b87967",
} as const;
type Point = Readonly<{ x: number; y: number }>;
type Attack = Readonly<{ from: Point; to: Point; classId: DefenseClass; rank: number; color: string; until: number }>;
type Hit = Readonly<{ point: Point; until: number }>;

function terrain(ctx: CanvasRenderingContext2D) {
  const light = ctx.createLinearGradient(0, 0, RULES.boardWidth, RULES.boardHeight);
  light.addColorStop(0, ART.grass); light.addColorStop(1, ART.forest);
  ctx.fillStyle = light; ctx.fillRect(0, 0, RULES.boardWidth, RULES.boardHeight);
  ctx.strokeStyle = ART.earth; ctx.lineWidth = 52; ctx.lineJoin = "round"; ctx.strokeRect(30, 30, 660, 420);
  ctx.strokeStyle = ART.stone; ctx.lineWidth = 34; ctx.strokeRect(30, 30, 660, 420);
  ctx.strokeStyle = ART.stoneLight; ctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const p = getEnemyPoint(i / 90);
    ctx.beginPath(); ctx.moveTo(p.x - 5, p.y - 4); ctx.lineTo(p.x + 5, p.y + 4); ctx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const x = 64 + (i * 137 % 592), y = 63 + (i * 71 % 354);
    ctx.strokeStyle = i % 3 === 0 ? ART.grass : ART.meadow;
    ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x, y + 5); ctx.lineTo(x + 2, y - 2); ctx.stroke();
  }
  for (const cell of CELLS) {
    ctx.fillStyle = "#15282030";
    ctx.beginPath(); ctx.ellipse(cell.x, cell.y + 14, 31, 12, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function capybara(ctx: CanvasRenderingContext2D, unit: DefenseUnit) {
  ctx.fillStyle = ART.fur; ctx.beginPath(); ctx.roundRect(-22, -8, 42, 29, 12); ctx.fill();
  ctx.fillStyle = ART.ink; ctx.beginPath(); ctx.roundRect(-17, 13, 9, 13, 3); ctx.roundRect(8, 13, 9, 13, 3); ctx.fill();
  ctx.fillStyle = ART.furLight; ctx.beginPath(); ctx.roundRect(-23, -28, 44, 32, 13); ctx.fill();
  ctx.fillStyle = ART.fur;
  ctx.beginPath(); ctx.ellipse(-15, -28, 6, 7, -.3, 0, Math.PI * 2); ctx.ellipse(13, -28, 6, 7, .3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ART.muzzle; ctx.beginPath(); ctx.roundRect(-6, -14, 28, 18, 7); ctx.fill();
  ctx.fillStyle = ART.ink;
  ctx.beginPath(); ctx.arc(-10, -15, 2.2, 0, Math.PI * 2); ctx.arc(11, -15, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(18, -8, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ART.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(1, -2); ctx.lineTo(16, -2); ctx.stroke();
  ctx.fillStyle = ART[unit.classId]; ctx.strokeStyle = ART[unit.classId]; ctx.lineWidth = 3;
  const costumes: Record<DefenseClass, () => void> = {
    warrior: () => {
      ctx.beginPath(); ctx.roundRect(-26, 0, 16, 21, [3, 3, 8, 8]); ctx.fill();
      ctx.strokeStyle = ART.cream; ctx.beginPath(); ctx.moveTo(26, 11); ctx.lineTo(30, -20); ctx.moveTo(21, 1); ctx.lineTo(34, 3); ctx.stroke();
      ctx.fillRect(-20, -29, 35, 5);
    },
    archer: () => {
      ctx.beginPath(); ctx.moveTo(26, -20); ctx.quadraticCurveTo(46, 0, 25, 20); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(26, -20); ctx.lineTo(25, 20); ctx.stroke();
      ctx.fillRect(-20, -28, 37, 5); ctx.beginPath(); ctx.ellipse(-13, -35, 3, 12, -.7, 0, Math.PI * 2); ctx.fill();
    },
    mage: () => {
      ctx.beginPath(); ctx.moveTo(-22, -26); ctx.lineTo(-6, -52); ctx.lineTo(17, -26); ctx.closePath(); ctx.fill(); ctx.fillRect(-25, -28, 46, 5);
      ctx.strokeStyle = ART.furLight; ctx.beginPath(); ctx.moveTo(28, 23); ctx.lineTo(28, -24); ctx.stroke();
      ctx.beginPath(); ctx.arc(28, -27, 6, 0, Math.PI * 2); ctx.fill();
    },
  };
  costumes[unit.classId]();
  ctx.fillStyle = ART[unit.rarity]; ctx.beginPath(); ctx.arc(0, 30, 3, 0, Math.PI * 2); ctx.fill();
}

export function createDefenseRenderer(ctx: CanvasRenderingContext2D) {
  const sprite = new Image();
  sprite.src = CAPYBARA_SPRITE;
  let spriteWasReady = false;
  let previous: DefenseState | null = null;
  let lastSelection: readonly number[] = [];
  let lastReducedMotion = false;
  let attacks: Attack[] = [];
  let hits: Hit[] = [];
  return (state: DefenseState, selectedIds: readonly number[], reducedMotion: boolean) => {
    const spriteReady = sprite.complete && sprite.naturalWidth > 0;
    if (previous === state && lastSelection === selectedIds && lastReducedMotion === reducedMotion && spriteWasReady === spriteReady) return;
    spriteWasReady = spriteReady;
    lastSelection = selectedIds; lastReducedMotion = reducedMotion;
    if (previous !== state) {
      if (previous && previous.elapsedMs <= state.elapsedMs) {
        for (const enemy of previous.enemies) {
          const next = state.enemies.find((candidate) => candidate.id === enemy.id);
          if (!next || next.hp < enemy.hp) hits.push({ point: getEnemyPoint(enemy.progress), until: state.elapsedMs + 150 });
        }
        for (const unit of state.units) {
          const prior = previous.units.find((candidate) => candidate.id === unit.id);
          const cell = getUnitPoint(unit);
          const spec = getUnitStats(state, unit);
          if (!prior || !cell || !spec || unit.cooldownMs <= prior.cooldownMs) continue;
          const target = previous.enemies.find((enemy) => {
            const p = getEnemyPoint(enemy.progress);
            return Math.hypot(p.x - cell.x, p.y - cell.y) <= spec.range;
          });
          const visual = getDefenderVisual(unit.rarity);
          if (target) attacks.push({ from: cell, to: getEnemyPoint(target.progress), classId: unit.classId, rank: visual.rank, color: visual.color, until: state.elapsedMs + 160 });
        }
      } else { attacks = []; hits = []; }
      previous = state;
    }
    terrain(ctx);
    attacks = attacks.filter((attack) => attack.until > state.elapsedMs).slice(-96);
    hits = hits.filter((hit) => hit.until > state.elapsedMs);
    for (const unit of [...state.units].sort((a, b) => Number(selectedIds.includes(a.id)) - Number(selectedIds.includes(b.id)))) {
      const cell = getUnitPoint(unit);
      if (!cell) continue;
      const spec = getUnitStats(state, unit);
      if (selectedIds.includes(unit.id)) {
        ctx.strokeStyle = ART.cream; ctx.fillStyle = "#fff1ca0b"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cell.x, cell.y, spec.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      const visual = getDefenderVisual(unit.rarity);
      ctx.save(); ctx.translate(cell.x, cell.y);
      ctx.fillStyle = "#15282080"; ctx.beginPath(); ctx.ellipse(0, 21, visual.size * .32, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = visual.color; ctx.lineWidth = visual.rank >= 5 ? 2 : 1; ctx.globalAlpha = .7;
      for (let ring = 0; ring < visual.rings; ring++) {
        ctx.beginPath(); ctx.ellipse(0, 20, visual.size * .36 + ring * 5, 12 + ring * 3, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (spriteReady) {
        ctx.drawImage(sprite, -visual.size / 2, 24 - visual.size, visual.size, visual.size);
        ctx.strokeStyle = ART[unit.classId]; ctx.fillStyle = ART[unit.classId]; ctx.lineWidth = 3;
        if (unit.classId === "warrior") { ctx.beginPath(); ctx.roundRect(-visual.size * .3, -8, 15, 22, [3, 3, 8, 8]); ctx.fill(); }
        if (unit.classId === "archer") { ctx.beginPath(); ctx.moveTo(visual.size * .28, -22); ctx.quadraticCurveTo(visual.size * .55, -4, visual.size * .28, 16); ctx.stroke(); }
        if (unit.classId === "mage") { ctx.beginPath(); ctx.moveTo(visual.size * .32, 16); ctx.lineTo(visual.size * .32, -25); ctx.stroke(); ctx.beginPath(); ctx.arc(visual.size * .32, -28, 5, 0, Math.PI * 2); ctx.fill(); }
      } else { ctx.save(); ctx.scale(visual.size / 84, visual.size / 84); capybara(ctx, unit); ctx.restore(); }
      if (visual.rank >= 8) {
        ctx.strokeStyle = visual.color; ctx.lineWidth = 2; ctx.beginPath();
        for (let ray = 0; ray < 5; ray++) { const angle = Math.PI + ray * Math.PI / 4; ctx.moveTo(Math.cos(angle) * 22, 4 - visual.size * .65 + Math.sin(angle) * 12); ctx.lineTo(Math.cos(angle) * 29, 4 - visual.size * .65 + Math.sin(angle) * 19); } ctx.stroke();
      }
      if (!reducedMotion) for (let spark = 0; spark < visual.sparks; spark++) {
        const angle = state.elapsedMs / 1400 + spark * Math.PI * 2 / visual.sparks;
        ctx.fillStyle = visual.color; ctx.beginPath(); ctx.arc(Math.cos(angle) * visual.size * .4, Math.sin(angle) * 15 + 8, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    for (const enemy of state.enemies) {
      const point = getEnemyPoint(enemy.progress), size = enemy.isBoss ? 24 : enemy.size === "large" ? 17 : enemy.size === "medium" ? 14 : 10;
      ctx.save(); ctx.translate(point.x, point.y);
      ctx.fillStyle = "#15282080"; ctx.beginPath(); ctx.ellipse(0, size * .65, size, size * .45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = enemy.isBoss ? ART.plum : [ART.moss, ART.rust, ART.plum][enemy.round % 3];
      ctx.beginPath(); ctx.moveTo(-size, size * .5); ctx.quadraticCurveTo(-size * 1.3, -size, 0, -size);
      ctx.quadraticCurveTo(size * 1.3, -size, size, size * .5); ctx.lineTo(size * .5, size * .8); ctx.lineTo(0, size * .5); ctx.lineTo(-size * .5, size * .8); ctx.closePath(); ctx.fill();
      if (enemy.isBoss) {
        ctx.fillStyle = ART.stoneLight; ctx.beginPath(); ctx.moveTo(-21, -8); ctx.lineTo(-29, -31); ctx.lineTo(-7, -20); ctx.moveTo(21, -8); ctx.lineTo(29, -31); ctx.lineTo(7, -20); ctx.fill();
      }
      ctx.fillStyle = ART.cream; ctx.fillRect(-size * .55, -4, size * .3, 5); ctx.fillRect(size * .25, -4, size * .3, 5);
      ctx.fillStyle = ART.ink; ctx.fillRect(-size, -size - 10, size * 2, 4);
      ctx.fillStyle = enemy.isBoss ? ART.legendary : ART.archer; ctx.fillRect(-size, -size - 10, size * 2 * enemy.hp / enemy.maxHp, 4);
      if (enemy.maxShield > 0) { ctx.fillStyle = ART.rare; ctx.fillRect(-size, -size - 15, size * 2 * enemy.shield / enemy.maxShield, 3); }
      if (enemy.lockedUntilMs > state.elapsedMs || enemy.slowedUntilMs > state.elapsedMs) { ctx.strokeStyle = enemy.lockedUntilMs > state.elapsedMs ? ART.legendary : ART.archer; ctx.lineWidth = 2; ctx.strokeRect(-size - 3, -size - 3, size * 2 + 6, size * 2 + 6); }
      if (state.units.some(unit => selectedIds.includes(unit.id) && unit.focusEnemyId === enemy.id)) { ctx.strokeStyle = ART.cream; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, size + 7, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    if (reducedMotion) return;
    for (const attack of attacks) {
      ctx.globalAlpha = Math.min(1, (attack.until - state.elapsedMs) / 100);
      ctx.strokeStyle = attack.rank >= 5 ? attack.color : ART[attack.classId]; ctx.lineWidth = (attack.classId === "mage" ? 3 : 1.5) + attack.rank * .45;
      ctx.beginPath(); ctx.moveTo(attack.from.x, attack.from.y); ctx.lineTo(attack.to.x, attack.to.y); ctx.stroke();
      if (attack.rank >= 5) { ctx.strokeStyle = ART.cream; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(attack.from.x, attack.from.y); ctx.lineTo(attack.to.x, attack.to.y); ctx.stroke(); ctx.strokeStyle = attack.color; ctx.beginPath(); ctx.arc(attack.to.x, attack.to.y, 5 + attack.rank * 1.5 + (160 - attack.until + state.elapsedMs) / 12, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    for (const hit of hits) {
      ctx.strokeStyle = ART.cream; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hit.point.x, hit.point.y, 17, 0, Math.PI * 2); ctx.stroke();
    }
  };
}
