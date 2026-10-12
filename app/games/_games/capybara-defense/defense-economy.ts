import type { ActionResult, DefenseClass, DefenseRarity, DefenseState, DefenseUnit } from "./defense-model";
import { CLASSES, RARITIES, RULES, getCollectionProgress, getUpgradeCost, random, rarityRank, rarityStats } from "./defense-rules";

export function makeUnit(id: number, classId: DefenseClass, rarity: DefenseRarity): DefenseUnit {
  return { id, classId, rarity, cellIndex: null, position: null, cooldownMs: 0, mana: RULES.maxMana, focusEnemyId: null };
}
export function summonUnit(state: DefenseState): ActionResult {
  if (state.phase !== "playing") return { state, error: "전투 중에 소환할 수 있어요." };
  if (state.units.length >= RULES.maxUnits) return { state, error: "유닛이 가득 찼어요. 낮은 등급을 판매해 주세요." };
  if (state.gold < RULES.summonCost) return { state, error: "소환할 골드가 부족해요." };
  const next = { ...state, gold: state.gold - RULES.summonCost, nextId: state.nextId + 1 };
  const classRoll = random(next);
  const classId = classRoll < 1 / 3 ? "warrior" : classRoll < 2 / 3 ? "archer" : "mage";
  let roll = random(next) * 100;
  let rarity: DefenseRarity = "apocalypse";
  for (const item of RARITIES) {
    if (roll < item.weight) { rarity = item.id; break; }
    roll -= item.weight;
  }
  next.units = [...state.units, { ...makeUnit(state.nextId, classId, rarity), position: { x: RULES.boardWidth / 2, y: RULES.boardHeight / 2 } }];
  return { state: next, error: null };
}
export function sellUnit(state: DefenseState, id: number): ActionResult {
  if (state.phase !== "playing") return { state, error: "전투 중에 판매할 수 있어요." };
  const unit = state.units.find(item => item.id === id);
  if (!unit) return { state, error: "판매할 유닛을 선택해 주세요." };
  if (rarityRank(unit.rarity) >= 5) return { state, error: "전설 이상은 판매할 수 없어요. 교환을 이용해 주세요." };
  return { state: { ...state, units: state.units.filter(item => item.id !== id), gold: state.gold + rarityStats(unit.rarity).sellGold }, error: null };
}
export function upgradeClass(state: DefenseState, classId: DefenseClass): ActionResult {
  if (state.phase !== "playing") return { state, error: "전투 중에 강화할 수 있어요." };
  if (!CLASSES.some(item => item.id === classId)) return { state, error: "강화할 계열을 선택해 주세요." };
  if (state.classLevels[classId] >= RULES.maxUpgradeLevel) return { state, error: "최대 강화에 도달했어요." };
  const cost = getUpgradeCost(state, classId);
  if (state.gold < cost) return { state, error: "강화할 골드가 부족해요." };
  return { state: { ...state, gold: state.gold - cost, classLevels: { ...state.classLevels, [classId]: state.classLevels[classId] + 1 } }, error: null };
}
export function redeemTicket(state: DefenseState, ticketId: number, classId: DefenseClass | "gamble"): ActionResult {
  const ticket = state.tickets.find(item => item.id === ticketId);
  if (state.phase !== "playing" || !ticket || state.units.length >= RULES.maxUnits) return { state, error: "선택권과 빈 유닛 자리가 필요해요." };
  if (classId !== "gamble" && !CLASSES.some(item => item.id === classId)) return { state, error: "보상 계열을 선택해 주세요." };
  const next = { ...state, tickets: state.tickets.filter(item => item.id !== ticketId), nextId: state.nextId + 1 };
  let rarity = ticket.rarity;
  let chosen: DefenseClass;
  if (classId === "gamble") {
    if (random(next) < RULES.ticketGambleChance) rarity = RARITIES[Math.min(9, rarityRank(rarity) + 1)].id;
    chosen = CLASSES[Math.floor(random(next) * CLASSES.length)].id;
  } else chosen = classId;
  next.units = [...state.units, { ...makeUnit(state.nextId, chosen, rarity), position: { x: RULES.boardWidth / 2, y: RULES.boardHeight / 2 } }];
  return { state: next, error: null };
}
export function exchangeUnit(state: DefenseState, unitId: number, classId: DefenseClass): ActionResult {
  const unit = state.units.find(item => item.id === unitId);
  if (state.phase !== "playing" || !unit || rarityRank(unit.rarity) < 5) return { state, error: "전설 이상 유닛을 선택해 주세요." };
  if (!CLASSES.some(item => item.id === classId) || unit.classId === classId) return { state, error: "다른 계열을 선택해 주세요." };
  if (state.gold < RULES.exchangeCost) return { state, error: "교환할 골드가 부족해요." };
  const next = { ...state, gold: state.gold - RULES.exchangeCost };
  if (random(next) < RULES.exchangeChance) next.units = state.units.map(item => item.id === unitId ? { ...item, classId } : item);
  return { state: next, error: null };
}
export function convertGas(state: DefenseState, amount: number): ActionResult {
  if (state.phase !== "playing" || !Number.isSafeInteger(amount) || amount <= 0 || amount > state.gas) return { state, error: "전환할 가스를 확인해 주세요." };
  return { state: { ...state, gas: state.gas - amount, gold: state.gold + amount * RULES.gasGoldRate }, error: null };
}
export function registerCollection(state: DefenseState, collectionId: string): ActionResult {
  const collection = getCollectionProgress(state).find(item => item.id === collectionId);
  if (state.phase !== "playing" || !collection?.ready) return { state, error: "세 계열을 모아 아직 등록하지 않은 컬렉션을 선택해 주세요." };
  return { state: { ...state, gold: state.gold + collection.gold, nextId: state.nextId + 1,
    tickets: [...state.tickets, { id: state.nextId, rarity: collection.ticket }], registeredCollections: [...state.registeredCollections, collectionId] }, error: null };
}
