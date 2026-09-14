import {
  createLocalRecordStore,
  parseStoredRecords,
  type RecordGuard,
} from "@/lib/games/local-records";

export interface LogDodgeRecord {
  id: string;
  /** 버틴 시간(ms) */
  timeMs: number;
  nearMisses: number;
  /** 오늘의 코스 날짜("2026-09-14"). 연습(랜덤) 판이면 null */
  course: string | null;
  at: number;
}

export const LEADERBOARD_SIZE = 5;
/** 표에는 상위 LEADERBOARD_SIZE개만 보여주지만, 몇 위인지 알려주려고 이만큼 저장한다 */
export const MAX_STORED_RECORDS = 100;

const isLogDodgeRecord: RecordGuard<LogDodgeRecord> = (value): value is LogDodgeRecord => {
  if (typeof value !== "object" || value === null) return false;
  const { id, timeMs, nearMisses, course, at } = value;
  return (
    typeof id === "string" &&
    typeof timeMs === "number" &&
    Number.isFinite(timeMs) &&
    typeof nearMisses === "number" &&
    Number.isFinite(nearMisses) &&
    (course === null || typeof course === "string") &&
    typeof at === "number" &&
    Number.isFinite(at)
  );
};

export function parseRecords(raw: string | null): LogDodgeRecord[] {
  return parseStoredRecords(raw, isLogDodgeRecord);
}

export function compareRecords(a: LogDodgeRecord, b: LogDodgeRecord) {
  return b.timeMs - a.timeMs || b.nearMisses - a.nearMisses || a.at - b.at;
}

export function getRank(records: readonly LogDodgeRecord[], record: LogDodgeRecord) {
  return records.filter((entry) => compareRecords(entry, record) < 0).length + 1;
}

export function insertRecord(records: readonly LogDodgeRecord[], record: LogDodgeRecord): LogDodgeRecord[] {
  return [...records, record].sort(compareRecords).slice(0, MAX_STORED_RECORDS);
}

/** 그날 코스 최고 기록(ms). 없으면 null */
export function getCourseBest(records: readonly LogDodgeRecord[], course: string) {
  const best = records.find((record) => record.course === course);
  return best ? best.timeMs : null;
}

const store = createLocalRecordStore("capybara-log-dodge-records", isLogDodgeRecord);

export const saveRecords = store.save;
export const useLogDodgeRecords = store.useRecords;
