// @vitest-environment node
import { describe, expect, it } from "vitest";

import { BAR_Y, createRun, GROUND, type Hazard, MAX_SPEED, PLAYER_H, PLAYER_X, type RunEvent, type RunInput, type RunState, SECOND_POINTS, START_SPEED, step } from "./logic";

const IDLE: RunInput = { jump: false, down: false };

/** 장애물을 직접 놓은 판 (자동 생성은 멀리 밀어 둔다) */
function course(hazards: Omit<Hazard, "id" | "passed" | "hit">[]): RunState {
  return { ...createRun(1), nextX: 1e9, hazards: hazards.map((hazard, index) => ({ ...hazard, id: index + 1, passed: false, hit: false })) };
}

function run(state: RunState, frames: number, input: (s: RunState, frame: number) => RunInput = () => IDLE) {
  const events: RunEvent[] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    const result = step(state, input(state, frame));
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

describe("capybara run logic", () => {
  it("gives points every second and shows them as events", () => {
    const { state, events } = run(course([]), 120);
    expect(state.score).toBe(SECOND_POINTS * 2);
    expect(events.filter((event) => event.type === "points")).toHaveLength(2);
  });

  it("speeds up over time but never past the cap", () => {
    expect(run(course([]), 600).state.speed).toBeGreaterThan(START_SPEED);
    expect(run(course([]), 60 * 60 * 10).state.speed).toBe(MAX_SPEED);
  });

  it("a single jump cannot reach the bar, a double jump grabs it and hangs to the end", () => {
    const bar = { kind: "bar" as const, x: PLAYER_X - 10, w: 900 };
    const single = run(course([bar]), 40, (_, frame) => ({ jump: frame === 0, down: false }));
    expect(single.events.some((event) => event.type === "grab")).toBe(false);

    const double = run(course([bar]), 30, (_, frame) => ({ jump: frame === 0 || frame === 12, down: false }));
    expect(double.events.some((event) => event.type === "double")).toBe(true);
    expect(double.state.player.mode).toBe("hang");
    expect(double.state.player.y - PLAYER_H).toBeGreaterThan(BAR_Y - 10);

    // 철봉이 끝나면 떨어져 착지하고, 완주 점수를 받는다
    const after = run(double.state, 200);
    expect(after.state.player.mode).toBe("run");
    expect(after.events).toContainEqual({ type: "points", points: 100, label: "철봉 완주" });
  });

  it("hanging carries the capybara safely over thorns", () => {
    const start = course([
      { kind: "bar", x: PLAYER_X - 10, w: 900 },
      { kind: "thorn", x: PLAYER_X + 200, w: 650 },
    ]);
    const { state, events } = run(start, 220, (_, frame) => ({ jump: frame === 0 || frame === 12, down: false }));
    expect(state.hearts).toBe(3);
    expect(events).toContainEqual({ type: "points", points: 60, label: "가시덩굴" });
  });

  it("standing hits a branch, sliding passes under it", () => {
    const branch = [{ kind: "branch" as const, x: PLAYER_X + 100, w: 50 }];
    expect(run(course(branch), 60).state.hearts).toBe(2);
    const slid = run(course(branch), 60, () => ({ jump: false, down: true }));
    expect(slid.state.hearts).toBe(3);
    expect(slid.events).toContainEqual({ type: "points", points: 30, label: "나뭇가지" });
  });

  it("jumping clears fire", () => {
    const fire = [{ kind: "fire" as const, x: PLAYER_X + 120, w: 80 }];
    expect(run(course(fire), 60).state.hearts).toBe(2);
    const jumped = run(course(fire), 80, (_, frame) => ({ jump: frame === 4, down: false }));
    expect(jumped.state.hearts).toBe(3);
    expect(jumped.state.player.y).toBe(GROUND);
  });

  it("ends after losing every heart", () => {
    const fires = [0, 1, 2].map((index) => ({ kind: "fire" as const, x: PLAYER_X + 200 + index * 900, w: 80 }));
    const { state, events } = run(course(fires), 600);
    expect(state.over).toBe(true);
    expect(events.some((event) => event.type === "over")).toBe(true);
  });

  it("builds the same course from the same seed", () => {
    const a = run(createRun(42), 1200).state.hazards.map((hazard) => [hazard.kind, Math.round(hazard.x)]);
    const b = run(createRun(42), 1200).state.hazards.map((hazard) => [hazard.kind, Math.round(hazard.x)]);
    expect(a).toEqual(b);
    expect(new Set(run(createRun(42), 60 * 40).state.hazards.map((hazard) => hazard.kind)).size).toBeGreaterThan(1);
  });
});
