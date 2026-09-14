import { beforeEach, describe, expect, it } from "vitest";

import { loadFishInventory, parseFishInventory, recordCatch } from "./fishing";

describe("낚시 가방", () => {
  beforeEach(() => localStorage.clear());

  it("망가지거나 이상한 저장값은 버린다", () => {
    expect(parseFishInventory(null)).toEqual({});
    expect(parseFishInventory("망가짐")).toEqual({});
    expect(parseFishInventory("[1,2]")).toEqual({});
    expect(parseFishInventory(JSON.stringify({ 붕어: 3, 메기: -1, 피라냐: 1.5, 상어: 9, 송사리: "2" }))).toEqual({ 붕어: 3 });
  });

  it("낚을 때마다 하나씩 쌓여 저장된다", () => {
    recordCatch("붕어");
    recordCatch("붕어");
    expect(recordCatch("메기")).toEqual({ 붕어: 2, 메기: 1 });
    expect(loadFishInventory()).toEqual({ 붕어: 2, 메기: 1 });
  });
});
