import {
  createLocalRecordStore,
  parseStoredRecords,
  type RecordGuard,
} from "@/lib/games/local-records";

export interface PangRecord {
  id: string;
  score: number;
  /** 한 판에서 가장 길게 이은 콤보 */
  maxCombo: number;
  at: number;
}

export const LEADERBOARD_SIZE = 5;
/** 표에는 상위 LEADERBOARD_SIZE개만 보여주지만, 몇 위인지 알려주려고 이만큼 저장한다 */
export const MAX_STORED_RECORDS = 100;

const isPangRecord: RecordGuard<PangRecord> = (value): value is PangRecord => {
  if (typeof value !== "object" || value === null) return false;
  const { id, score, maxCombo, at } = value;
  return (
    typeof id === "string" &&
    typeof score === "number" &&
    Number.isFinite(score) &&
    typeof maxCombo === "number" &&
    Number.isFinite(maxCombo) &&
    typeof at === "number" &&
    Number.isFinite(at)
  );
};

export function parseRecords(raw: string | null): PangRecord[] {
  return parseStoredRecords(raw, isPangRecord);
}

export function compareRecords(a: PangRecord, b: PangRecord) {
  return b.score - a.score || b.maxCombo - a.maxCombo || a.at - b.at;
}

export function getRank(records: readonly PangRecord[], record: PangRecord) {
  return records.filter((entry) => compareRecords(entry, record) < 0).length + 1;
}

export function insertRecord(records: readonly PangRecord[], record: PangRecord): PangRecord[] {
  return [...records, record].sort(compareRecords).slice(0, MAX_STORED_RECORDS);
}

const store = createLocalRecordStore("capybara-pang-records", isPangRecord);

export const saveRecords = store.save;
export const usePangRecords = store.useRecords;
