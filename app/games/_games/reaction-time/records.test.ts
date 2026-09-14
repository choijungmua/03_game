import { describe, expect, it } from "vitest";

import {
  getRank,
  insertRecord,
  LEADERBOARD_SIZE,
  MAX_STORED_RECORDS,
  parseRecords,
  type ReactionRecord,
} from "./records";

function record(ms: number, at: number): ReactionRecord {
  return { id: `${at}-${ms}`, ms, at };
}

describe("insertRecord", () => {
  it("빠른 기록 순으로 정렬한다", () => {
    const result = insertRecord([record(300, 1), record(150, 2)], record(200, 3));
    expect(result.map((r) => r.ms)).toEqual([150, 200, 300]);
  });

  it("같은 기록이면 먼저 세운 기록이 앞선다", () => {
    const result = insertRecord([record(200, 5)], record(200, 9));
    expect(result.map((r) => r.at)).toEqual([5, 9]);
  });

  it(`표에 보이는 ${LEADERBOARD_SIZE}개보다 많이 저장해서 순위를 매길 수 있게 한다`, () => {
    const existing = [100, 110, 120, 130, 140].map((ms, i) => record(ms, i));
    expect(insertRecord(existing, record(500, 99))).toHaveLength(6);
  });

  it(`최대 ${MAX_STORED_RECORDS}개까지만 저장한다`, () => {
    const existing = Array.from({ length: MAX_STORED_RECORDS }, (_, i) => record(100 + i, i));
    const result = insertRecord(existing, record(999, 999));
    expect(result).toHaveLength(MAX_STORED_RECORDS);
    expect(result.some((r) => r.ms === 999)).toBe(false);
  });
});

describe("getRank", () => {
  it("나보다 빠른 기록 수 + 1이 순위다", () => {
    const existing = [100, 110, 120, 130, 140].map((ms, i) => record(ms, i));
    expect(getRank(existing, record(115, 50))).toBe(3);
    expect(getRank(existing, record(500, 50))).toBe(6);
    expect(getRank([], record(200, 1))).toBe(1);
  });

  it("같은 기록이면 먼저 세운 기록이 앞선다", () => {
    expect(getRank([record(200, 1)], record(200, 9))).toBe(2);
  });
});

describe("parseRecords", () => {
  it("저장된 값이 없거나 깨져 있으면 빈 배열을 돌려준다", () => {
    expect(parseRecords(null)).toEqual([]);
    expect(parseRecords("not json")).toEqual([]);
    expect(parseRecords('{"ms":1}')).toEqual([]);
  });

  it("형식이 맞지 않는 항목은 버린다", () => {
    const raw = JSON.stringify([record(180, 1), { id: "x", ms: "fast", at: 2 }, null]);
    expect(parseRecords(raw)).toEqual([record(180, 1)]);
  });
});
