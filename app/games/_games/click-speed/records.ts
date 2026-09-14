import {
  createLocalRecordStore,
  parseStoredRecords,
  type RecordGuard,
} from "@/lib/games/local-records";

export interface ClickSpeedRecord {
  id: string;
  count: number;
  cps: number;
  /** 몇 초 동안 연타한 기록인지. 순위는 같은 시간끼리만 비교한다 */
  seconds: number;
  at: number;
}

export const LEADERBOARD_SIZE = 5;
/** 표에는 상위 LEADERBOARD_SIZE개만 보여주지만, 몇 위인지 알려주려고 시간별로 이만큼 저장한다 */
export const MAX_STORED_RECORDS = 100;

/** 고를 수 있는 연타 시간(초) */
export const DURATION_OPTIONS = [3, 5, 10, 30] as const;
export type ClickSpeedSeconds = (typeof DURATION_OPTIONS)[number];
export const DEFAULT_SECONDS: ClickSpeedSeconds = 5;

/** 정한 시간 동안의 초당 클릭 수 (소수 첫째 자리 반올림) */
export function calculateCps(count: number, seconds: number): number {
  if (seconds <= 0) return 0;
  return Math.round((count / seconds) * 10) / 10;
}

const isClickSpeedRecord: RecordGuard<ClickSpeedRecord> = (value): value is ClickSpeedRecord => {
  if (typeof value !== "object" || value === null) return false;
  const { id, count, cps, seconds, at } = value;
  return (
    typeof id === "string" &&
    typeof count === "number" &&
    Number.isFinite(count) &&
    typeof cps === "number" &&
    Number.isFinite(cps) &&
    typeof seconds === "number" &&
    Number.isFinite(seconds) &&
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

/** 같은 시간 기록 중 몇 위인지 */
export function getRank(records: readonly ClickSpeedRecord[], record: ClickSpeedRecord) {
  return (
    records.filter((entry) => entry.seconds === record.seconds && compareRecords(entry, record) < 0).length + 1
  );
}

/** 같은 시간 기록 안에서만 정렬·자르고, 다른 시간 기록은 그대로 둔다 */
export function insertRecord(
  records: readonly ClickSpeedRecord[],
  record: ClickSpeedRecord,
): ClickSpeedRecord[] {
  const sameSeconds = [...records.filter((entry) => entry.seconds === record.seconds), record]
    .sort(compareRecords)
    .slice(0, MAX_STORED_RECORDS);
  return [...records.filter((entry) => entry.seconds !== record.seconds), ...sameSeconds];
}

// 예전(손을 멈추면 끝나던 방식) 기록은 시간 기준이 달라 섞지 않고 새 키에 쌓는다
const store = createLocalRecordStore("click-speed-timed-records", isClickSpeedRecord);

export const saveRecords = store.save;
export const useClickSpeedRecords = store.useRecords;
