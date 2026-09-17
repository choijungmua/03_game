import { createLocalRecordStore, type RecordGuard } from "@/lib/games/local-records";

export interface WatermelonRecord {
  id: string;
  score: number;
  /** 이번 판에서 만든 가장 큰 과일 (FRUITS 인덱스) */
  maxLevel: number;
  at: number;
}

export const LEADERBOARD_SIZE = 5;
/** 표에는 상위 LEADERBOARD_SIZE개만 보여주지만, 몇 위인지 알려주려고 이만큼 저장한다 */
export const MAX_STORED_RECORDS = 100;

const isWatermelonRecord: RecordGuard<WatermelonRecord> = (value): value is WatermelonRecord => {
  if (typeof value !== "object" || value === null) return false;
  const { id, score, maxLevel, at } = value;
  return (
    typeof id === "string" &&
    typeof score === "number" &&
    Number.isFinite(score) &&
    typeof maxLevel === "number" &&
    Number.isInteger(maxLevel) &&
    typeof at === "number" &&
    Number.isFinite(at)
  );
};

export function compareRecords(a: WatermelonRecord, b: WatermelonRecord) {
  return b.score - a.score || b.maxLevel - a.maxLevel || a.at - b.at;
}

export function getRank(records: readonly WatermelonRecord[], record: WatermelonRecord) {
  return records.filter((entry) => compareRecords(entry, record) < 0).length + 1;
}

export function insertRecord(records: readonly WatermelonRecord[], record: WatermelonRecord): WatermelonRecord[] {
  return [...records, record].sort(compareRecords).slice(0, MAX_STORED_RECORDS);
}

const store = createLocalRecordStore("watermelon-game-records", isWatermelonRecord);

export const saveRecords = store.save;
export const useWatermelonRecords = store.useRecords;
