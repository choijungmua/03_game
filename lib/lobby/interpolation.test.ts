// @vitest-environment node
import { describe, expect, it } from "vitest";

import { pushSnapshot, sampleSnapshots, type Snapshot } from "./interpolation";

const STEP_MS = 150;

describe("다른 유저 위치 보간", () => {
  it("받은 위치 사이를 일정한 속도로 잇는다", () => {
    const buffer: Snapshot[] = [];
    pushSnapshot(buffer, 0, 0, 0, STEP_MS);
    pushSnapshot(buffer, 36, 0, 150, STEP_MS);
    pushSnapshot(buffer, 72, 0, 300, STEP_MS);

    expect(sampleSnapshots(buffer, 75).x).toBeCloseTo(18);
    expect(sampleSnapshots(buffer, 225).x).toBeCloseTo(54);
  });

  it("폴링이 엇갈려 같은 위치가 또 와도 멈칫했다가 급가속하지 않는다", () => {
    const buffer: Snapshot[] = [];
    pushSnapshot(buffer, 0, 0, 0, STEP_MS);
    pushSnapshot(buffer, 0, 0, 150, STEP_MS);
    pushSnapshot(buffer, 72, 0, 300, STEP_MS);

    expect(sampleSnapshots(buffer, 150).x).toBeCloseTo(36);
  });

  it("새 위치가 더 오지 않으면 마지막 위치에 멈춰 있다", () => {
    const buffer: Snapshot[] = [];
    pushSnapshot(buffer, 0, 0, 0, STEP_MS);
    pushSnapshot(buffer, 36, 12, 150, STEP_MS);

    expect(sampleSnapshots(buffer, 1_000)).toEqual({ x: 36, y: 12 });
  });

  it("오래 서 있다가 걷기 시작하면 서 있던 시간에 걸쳐 느리게 오지 않고 한 틱 동안 걷는다", () => {
    const buffer: Snapshot[] = [];
    pushSnapshot(buffer, 0, 0, 0, STEP_MS);
    pushSnapshot(buffer, 36, 0, 2_000, STEP_MS);

    expect(sampleSnapshots(buffer, 1_800).x).toBe(0);
    expect(sampleSnapshots(buffer, 1_925).x).toBeCloseTo(18);
  });

  it("처음 받은 위치보다 이른 시각은 그 자리에 둔다", () => {
    const buffer: Snapshot[] = [];
    pushSnapshot(buffer, 10, 20, 500, STEP_MS);

    expect(sampleSnapshots(buffer, 100)).toEqual({ x: 10, y: 20 });
  });

  it("버퍼는 오래된 위치를 버려 짧게 유지한다", () => {
    const buffer: Snapshot[] = [];
    for (let i = 0; i < 50; i += 1) pushSnapshot(buffer, i * 36, 0, i * 150, STEP_MS);
    expect(buffer.length).toBeLessThanOrEqual(8);
    expect(sampleSnapshots(buffer, 49 * 150).x).toBe(49 * 36);
  });
});
