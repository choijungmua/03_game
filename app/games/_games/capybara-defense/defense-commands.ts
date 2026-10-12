import type { ActionResult, DefenseClass, DefenseCommand, DefenseState } from "./defense-model";
import { RULES } from "./defense-rules";
import { convertGas, exchangeUnit, redeemTicket, registerCollection, sellUnit, summonUnit, upgradeClass } from "./defense-economy";
import { castAbility } from "./defense-combat";
import { pauseGame, resumeGame, startGame } from "./engine";

const id = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const classId = (value: unknown): value is DefenseClass => value === "warrior" || value === "archer" || value === "mage";
const ids = (value: unknown): value is number[] => Array.isArray(value) && value.length > 0 && value.length <= RULES.maxUnits && value.every(id) && new Set(value).size === value.length;
export function parseDefenseCommand(value: unknown): DefenseCommand | null {
  if (typeof value !== "object" || value === null || !("type" in value)) return null;
  switch (value.type) {
    case "start": case "pause": case "resume": case "summon": return { type: value.type };
    case "move":
      if (!("unitIds" in value) || !ids(value.unitIds) || !("x" in value) || !("y" in value) || typeof value.x !== "number" || typeof value.y !== "number" || !Number.isFinite(value.x) || !Number.isFinite(value.y) || value.x < 50 || value.x > 670 || value.y < 50 || value.y > 430) return null;
      return { type: "move", unitIds: value.unitIds, x: value.x, y: value.y };
    case "focus":
      if (!("unitIds" in value) || !ids(value.unitIds) || !("enemyId" in value) || (value.enemyId !== null && !id(value.enemyId))) return null;
      return { type: "focus", unitIds: value.unitIds, enemyId: value.enemyId };
    case "sell":
      return "unitId" in value && id(value.unitId) ? { type: "sell", unitId: value.unitId } : null;
    case "upgrade":
      return "classId" in value && classId(value.classId) ? { type: "upgrade", classId: value.classId } : null;
    case "speed":
      return "speed" in value && (value.speed === 1 || value.speed === 2 || value.speed === 4) ? { type: "speed", speed: value.speed } : null;
    case "ticket":
      return "ticketId" in value && id(value.ticketId) && "classId" in value && (classId(value.classId) || value.classId === "gamble") ? { type: "ticket", ticketId: value.ticketId, classId: value.classId } : null;
    case "exchange":
      return "unitId" in value && id(value.unitId) && "classId" in value && classId(value.classId) ? { type: "exchange", unitId: value.unitId, classId: value.classId } : null;
    case "convert":
      return "amount" in value && id(value.amount) ? { type: "convert", amount: value.amount } : null;
    case "collection":
      return "collectionId" in value && typeof value.collectionId === "string" && value.collectionId.length <= 64 ? { type: "collection", collectionId: value.collectionId } : null;
    case "ability":
      return "unitId" in value && id(value.unitId) && "enemyId" in value && id(value.enemyId) ? { type: "ability", unitId: value.unitId, enemyId: value.enemyId } : null;
    default: return null;
  }
}
export function applyCommand(state: DefenseState, input: DefenseCommand): ActionResult {
  const command = parseDefenseCommand(input);
  if (!command) return { state, error: "명령을 확인해 주세요." };
  switch (command.type) {
    case "start": return state.phase === "idle" ? { state: startGame(state), error: null } : { state, error: "이미 시작한 게임이에요." };
    case "pause": return state.phase === "playing" ? { state: pauseGame(state), error: null } : { state, error: "진행 중인 게임을 멈출 수 있어요." };
    case "resume": return state.phase === "paused" ? { state: resumeGame(state), error: null } : { state, error: "멈춘 게임을 재개할 수 있어요." };
    default: break;
  }
  if (state.phase !== "playing") return { state, error: "전투 중에 사용할 수 있어요." };
  switch (command.type) {
    case "summon": return summonUnit(state);
    case "sell": return sellUnit(state, command.unitId);
    case "upgrade": return upgradeClass(state, command.classId);
    case "ticket": return redeemTicket(state, command.ticketId, command.classId);
    case "exchange": return exchangeUnit(state, command.unitId, command.classId);
    case "convert": return convertGas(state, command.amount);
    case "collection": return registerCollection(state, command.collectionId);
    case "ability": return castAbility(state, command.unitId, command.enemyId);
    case "speed": return { state: { ...state, speed: command.speed }, error: null };
    case "move":
      if (!command.unitIds.every(unitId => state.units.some(unit => unit.id === unitId))) return { state, error: "이동할 유닛을 확인해 주세요." };
      return { state: { ...state, units: state.units.map(unit => command.unitIds.includes(unit.id) ? { ...unit, cellIndex: null, position: { x: command.x, y: command.y } } : unit) }, error: null };
    case "focus":
      if (!command.unitIds.every(unitId => state.units.some(unit => unit.id === unitId)) || (command.enemyId !== null && !state.enemies.some(enemy => enemy.id === command.enemyId && enemy.hp > 0))) return { state, error: "집중 공격할 유닛과 적을 확인해 주세요." };
      return { state: { ...state, units: state.units.map(unit => command.unitIds.includes(unit.id) ? { ...unit, focusEnemyId: command.enemyId } : unit) }, error: null };
    default: return assertNever(command);
  }
}
function assertNever(value: never): never { throw new Error(`Unknown defense command: ${String(value)}`); }
