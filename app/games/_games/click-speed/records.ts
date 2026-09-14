import {
  createLocalRecordStore,
  parseStoredRecords,
  type RecordGuard,
} from "@/lib/games/local-records";

export interface ClickSpeedRecord {
  id: string;
  count: number;
  cps: number;
  at: number;
}

export const LEADERBOARD_SIZE = 5;
/** 표에는 상위 LEADERBOARD_SIZE개만 보여주지만, 몇 위인지 알려주려고 이만큼 저장한다 */
export const MAX_STORED_RECORDS = 100;

/** 첫 탭부터 마지막 탭까지의 간격 기준 초당 클릭 수 (소수 첫째 자리 반올림) */
export function calculateCps(count: number, firstTapAt: number, lastTapAt: number): number {
  const durationMs = lastTapAt - firstTapAt;
  if (count < 2 || durationMs <= 0) return 0;
  return Math.round(((count - 1) / (durationMs / 1000)) * 10) / 10;
}

const isClickSpeedRecord: RecordGuard<ClickSpeedRecord> = (value): value is ClickSpeedRecord => {
  if (typeof value !== "object" || value === null) return false;
  const { id, count, cps, at } = value;
  return (
    typeof id === "string" &&
    typeof count === "number" &&
    Number.isFinite(count) &&
    typeof cps === "number" &&
    Number.isFinite(cps) &&
    typeof at === "number" &&
    Number.isFinite(at)
  );
};

export function parseRecords(raw: string | null): ClickSpeedRecord[] {
  return parseStoredRecords(raw, isClickSpeedRecord);
}

export function compareRecords(a: ClickSpeedRecord, b: ClickSpeedRecord) {
  return b.count - a.count || b.cps - a.cps || a.at - b.at;
}

export function getRank(records: readonly ClickSpeedRecord[], record: ClickSpeedRecord) {
  return records.filter((entry) => compareRecords(entry, record) < 0).length + 1;
}

export function insertRecord(
  records: readonly ClickSpeedRecord[],
  record: ClickSpeedRecord,
): ClickSpeedRecord[] {
  return [...records, record].sort(compareRecords).slice(0, MAX_STORED_RECORDS);
}

const store = createLocalRecordStore("click-speed-records", isClickSpeedRecord);

export const saveRecords = store.save;
export const useClickSpeedRecords = store.useRecords;
