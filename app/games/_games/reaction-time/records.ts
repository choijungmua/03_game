import {
  createLocalRecordStore,
  parseStoredRecords,
  type RecordGuard,
} from "@/lib/games/local-records";

export interface ReactionRecord {
  id: string;
  ms: number;
  at: number;
}

export const LEADERBOARD_SIZE = 5;
/** 표에는 상위 LEADERBOARD_SIZE개만 보여주지만, 몇 위인지 알려주려고 이만큼 저장한다 */
export const MAX_STORED_RECORDS = 100;

const isReactionRecord: RecordGuard<ReactionRecord> = (value): value is ReactionRecord => {
  if (typeof value !== "object" || value === null) return false;
  const { id, ms, at } = value;
  return (
    typeof id === "string" &&
    typeof ms === "number" &&
    Number.isFinite(ms) &&
    typeof at === "number" &&
    Number.isFinite(at)
  );
};

export function parseRecords(raw: string | null): ReactionRecord[] {
  return parseStoredRecords(raw, isReactionRecord);
}

export function compareRecords(a: ReactionRecord, b: ReactionRecord) {
  return a.ms - b.ms || a.at - b.at;
}

export function getRank(records: readonly ReactionRecord[], record: ReactionRecord) {
  return records.filter((entry) => compareRecords(entry, record) < 0).length + 1;
}

export function insertRecord(
  records: readonly ReactionRecord[],
  record: ReactionRecord,
): ReactionRecord[] {
  return [...records, record].sort(compareRecords).slice(0, MAX_STORED_RECORDS);
}

const store = createLocalRecordStore("reaction-time-records", isReactionRecord);

export const saveRecords = store.save;
export const useReactionRecords = store.useRecords;
