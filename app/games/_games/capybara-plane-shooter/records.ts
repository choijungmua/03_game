import {
  createLocalRecordStore,
  parseStoredRecords,
  type RecordGuard,
} from "@/lib/games/local-records";

export interface PlaneShooterRecord {
  id: string;
  score: number;
  /** 격추된 스테이지 */
  stage: number;
  at: number;
}

export const LEADERBOARD_SIZE = 5;
/** 표에는 상위 LEADERBOARD_SIZE개만 보여주지만, 몇 위인지 알려주려고 이만큼 저장한다 */
export const MAX_STORED_RECORDS = 100;

const isPlaneShooterRecord: RecordGuard<PlaneShooterRecord> = (value): value is PlaneShooterRecord => {
  if (typeof value !== "object" || value === null) return false;
  const { id, score, stage, at } = value;
  return (
    typeof id === "string" &&
    typeof score === "number" &&
    Number.isFinite(score) &&
    typeof stage === "number" &&
    Number.isFinite(stage) &&
    typeof at === "number" &&
    Number.isFinite(at)
  );
};

export function parseRecords(raw: string | null): PlaneShooterRecord[] {
  return parseStoredRecords(raw, isPlaneShooterRecord);
}

export function compareRecords(a: PlaneShooterRecord, b: PlaneShooterRecord) {
  return b.score - a.score || b.stage - a.stage || a.at - b.at;
}

export function getRank(records: readonly PlaneShooterRecord[], record: PlaneShooterRecord) {
  return records.filter((entry) => compareRecords(entry, record) < 0).length + 1;
}

export function insertRecord(
  records: readonly PlaneShooterRecord[],
  record: PlaneShooterRecord,
): PlaneShooterRecord[] {
  return [...records, record].sort(compareRecords).slice(0, MAX_STORED_RECORDS);
}

const scoreFormat = new Intl.NumberFormat("ko-KR");

export function formatScore(score: number) {
  return scoreFormat.format(score);
}

const store = createLocalRecordStore("capybara-plane-shooter-records", isPlaneShooterRecord);

export const saveRecords = store.save;
export const usePlaneShooterRecords = store.useRecords;
