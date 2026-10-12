import { createLocalRecordStore, type RecordGuard } from "@/lib/games/local-records";

export interface RunRecord {
  id: string;
  score: number;
  /** 달린 시간(초) */
  seconds: number;
  at: number;
}

export const LEADERBOARD_SIZE = 5;
/** 표에는 상위 5개만 보여주지만, 몇 위인지 알려주려고 이만큼 저장한다 */
const MAX_STORED_RECORDS = 100;

const isRunRecord: RecordGuard<RunRecord> = (value): value is RunRecord =>
  typeof value === "object" &&
  value !== null &&
  typeof value.id === "string" &&
  Number.isFinite(value.score) &&
  Number.isFinite(value.seconds) &&
  Number.isFinite(value.at);

export function compareRecords(a: RunRecord, b: RunRecord) {
  return b.score - a.score || a.at - b.at;
}

export function getRank(records: readonly RunRecord[], record: RunRecord) {
  return records.filter((entry) => compareRecords(entry, record) < 0).length + 1;
}

export function insertRecord(records: readonly RunRecord[], record: RunRecord) {
  return [...records, record].sort(compareRecords).slice(0, MAX_STORED_RECORDS);
}

const store = createLocalRecordStore("capybara-run-records", isRunRecord);
export const saveRecords = store.save;
export const useRunRecords = store.useRecords;

export interface RunTier {
  label: string;
  minScore: number;
  description: string;
  bgClass: string;
  fgClass: string;
}

export const RUN_TIERS: readonly RunTier[] = [
  { label: "바람보다 빠른 바라", minScore: 5000, description: "최고 속도에서도 철봉과 가시덩굴을 가볍게 넘었어요", bgClass: "bg-violet-600", fgClass: "text-white" },
  { label: "철봉 곡예사", minScore: 3000, description: "2단 점프로 철봉을 잡고 불길 위를 건넜어요", bgClass: "bg-primary", fgClass: "text-white" },
  { label: "질주 카피바라", minScore: 1500, description: "빨라지는 속도에도 점프와 숙이기가 척척이에요", bgClass: "bg-success", fgClass: "text-neutral-950" },
  { label: "뛰기 시작한 바라", minScore: 600, description: "통나무와 불길은 이제 문제없어요", bgClass: "bg-warning", fgClass: "text-neutral-950" },
  { label: "느긋한 산책", minScore: 0, description: "2단 점프로 철봉을 잡아 보세요", bgClass: "bg-neutral-500", fgClass: "text-white" },
];

export function getRunTier(score: number) {
  return RUN_TIERS.find((tier) => score >= tier.minScore) ?? RUN_TIERS[RUN_TIERS.length - 1];
}
