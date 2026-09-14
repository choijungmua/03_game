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

function record(count: number, cps: number, at: number, seconds = 5): ClickSpeedRecord {
  return { id: `${at}-${count}`, count, cps, seconds, at };
}

describe("calculateCps", () => {
  it("클릭 수를 정한 시간으로 나눠 초당 클릭 수를 구한다", () => {
    expect(calculateCps(50, 5)).toBe(10);
  });

  it("소수 첫째 자리까지 반올림한다", () => {
    expect(calculateCps(22, 3)).toBe(7.3);
  });

  it("탭이 없거나 시간이 0이면 0이다", () => {
    expect(calculateCps(0, 5)).toBe(0);
    expect(calculateCps(5, 0)).toBe(0);
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

  it(`시간마다 최대 ${MAX_STORED_RECORDS}개까지만 저장한다`, () => {
    const existing = Array.from({ length: MAX_STORED_RECORDS }, (_, i) => record(500 - i, 8, i));
    const result = insertRecord(existing, record(1, 8, 999));
    expect(result).toHaveLength(MAX_STORED_RECORDS);
    expect(result.some((r) => r.count === 1)).toBe(false);
  });

  it("다른 시간 기록은 건드리지 않는다", () => {
    const tenSeconds = record(999, 99, 1, 10);
    const result = insertRecord([tenSeconds], record(10, 2, 2));
    expect(result).toContainEqual(tenSeconds);
    expect(result).toHaveLength(2);
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

  it("다른 시간 기록은 순위에 넣지 않는다", () => {
    expect(getRank([record(300, 10, 1, 30)], record(20, 4, 2))).toBe(1);
  });
});

describe("parseRecords", () => {
  it("저장된 값이 없거나 깨져 있으면 빈 배열을 돌려준다", () => {
    expect(parseRecords(null)).toEqual([]);
    expect(parseRecords("oops")).toEqual([]);
  });

  it("형식이 맞지 않는 항목은 버린다", () => {
    const raw = JSON.stringify([record(12, 5.5, 1), { id: "x", count: 3, cps: 1, at: 2 }]);
    expect(parseRecords(raw)).toEqual([record(12, 5.5, 1)]);
  });
});
