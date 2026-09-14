import { describe, expect, it } from "vitest";

import {
  calculateCps,
  type ClickSpeedRecord,
  getRank,
  insertRecord,
  LEADERBOARD_SIZE,
  MAX_STORED_RECORDS,
  parseRecords,
} from "./records";

function record(count: number, cps: number, at: number): ClickSpeedRecord {
  return { id: `${at}-${count}`, count, cps, at };
}

describe("calculateCps", () => {
  it("첫 탭부터 마지막 탭까지의 간격으로 초당 클릭 수를 구한다", () => {
    expect(calculateCps(11, 0, 1000)).toBe(10);
  });

  it("소수 첫째 자리까지 반올림한다", () => {
    expect(calculateCps(4, 0, 700)).toBe(4.3);
  });

  it("탭이 한 번 이하이거나 간격이 없으면 0이다", () => {
    expect(calculateCps(0, 0, 0)).toBe(0);
    expect(calculateCps(1, 500, 500)).toBe(0);
    expect(calculateCps(5, 300, 300)).toBe(0);
  });
});

describe("insertRecord", () => {
  it("클릭 수가 많은 순으로 정렬한다", () => {
    const result = insertRecord([record(20, 6, 1), record(40, 8, 2)], record(30, 7, 3));
    expect(result.map((r) => r.count)).toEqual([40, 30, 20]);
  });

  it("클릭 수가 같으면 더 빠른 속도, 그다음 먼저 세운 기록이 앞선다", () => {
    const result = insertRecord([record(30, 6, 1), record(30, 9, 5)], record(30, 9, 9));
    expect(result.map((r) => r.at)).toEqual([5, 9, 1]);
  });

  it(`표에 보이는 ${LEADERBOARD_SIZE}개보다 많이 저장해서 순위를 매길 수 있게 한다`, () => {
    const existing = [50, 45, 40, 35, 30].map((count, i) => record(count, 8, i));
    expect(insertRecord(existing, record(10, 8, 99))).toHaveLength(6);
  });

  it(`최대 ${MAX_STORED_RECORDS}개까지만 저장한다`, () => {
    const existing = Array.from({ length: MAX_STORED_RECORDS }, (_, i) => record(500 - i, 8, i));
    const result = insertRecord(existing, record(1, 8, 999));
    expect(result).toHaveLength(MAX_STORED_RECORDS);
    expect(result.some((r) => r.count === 1)).toBe(false);
  });
});

describe("getRank", () => {
  it("나보다 앞선 기록 수 + 1이 순위다", () => {
    const existing = [50, 45, 40, 35, 30].map((count, i) => record(count, 8, i));
    expect(getRank(existing, record(42, 8, 50))).toBe(3);
    expect(getRank(existing, record(10, 8, 50))).toBe(6);
    expect(getRank([], record(20, 5, 1))).toBe(1);
  });

  it("클릭 수가 같으면 속도, 그다음 먼저 세운 기록 순이다", () => {
    expect(getRank([record(30, 8, 4)], record(30, 9, 50))).toBe(1);
    expect(getRank([record(30, 8, 4)], record(30, 8, 50))).toBe(2);
  });
});

describe("parseRecords", () => {
  it("저장된 값이 없거나 깨져 있으면 빈 배열을 돌려준다", () => {
    expect(parseRecords(null)).toEqual([]);
    expect(parseRecords("oops")).toEqual([]);
  });

  it("형식이 맞지 않는 항목은 버린다", () => {
    const raw = JSON.stringify([record(12, 5.5, 1), { id: "x", count: 3, at: 2 }]);
    expect(parseRecords(raw)).toEqual([record(12, 5.5, 1)]);
  });
});
