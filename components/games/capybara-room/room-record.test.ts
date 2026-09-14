import { describe, expect, it } from "vitest";

import { addRoomResult, type RecordableView, type RoomRecord, summarizeRecords } from "./room-record";

function ended(code: string, you: RecordableView["you"], winner: RecordableView["state"]["winner"]): RecordableView {
  return { code, you, state: { endReason: winner ? "five" : "draw", winner } };
}

describe("온라인 대전 전적", () => {
  it("끝난 판을 내 자리 기준으로 승·패·무로 한 번만 센다", () => {
    let records: RoomRecord[] = [];
    for (const view of [ended("AAAAAA", "black", "black"), ended("BBBBBB", "white", "black"), ended("CCCCCC", "black", null)]) {
      records = addRoomResult(records, view, 1) ?? records;
    }
    expect(summarizeRecords(records)).toEqual({ wins: 1, losses: 1, draws: 1 });
    // 같은 방이 다시 그려져도(폴링) 두 번 세지 않는다
    expect(addRoomResult(records, ended("AAAAAA", "black", "black"), 2)).toBeNull();
  });

  it("관전자이거나 아직 진행 중인 판은 세지 않는다", () => {
    expect(addRoomResult([], ended("AAAAAA", null, "black"), 1)).toBeNull();
    expect(addRoomResult([], { code: "AAAAAA", you: "black", state: { endReason: null, winner: null } }, 1)).toBeNull();
  });
});
