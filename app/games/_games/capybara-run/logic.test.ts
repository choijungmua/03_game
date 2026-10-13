// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  BAR_Y,
  BONUS_PER_COIN,
  type Coin,
  createRun,
  GROUND,
  type Hazard,
  jumpArc,
  MAX_SPEED,
  PLAYER_H,
  PLAYER_X,
  type RunEvent,
  type RunInput,
  type RunState,
  SECOND_POINTS,
  STAGE_BONUS_FRAMES,
  STAGE_START,
  STAR_BONUS_FRAMES,
  START_SPEED,
  step,
} from "./logic";

const IDLE: RunInput = { jump: false, down: false };

/** 장애물·코인을 직접 놓은 판 (자동 생성은 멀리 밀어 둔다) */
function course(hazards: Omit<Hazard, "id" | "passed" | "hit" | "top">[] & { top?: number }[], coins: Omit<Coin, "id" | "taken" | "kind">[] = []): RunState {
  const groups: RunState["groups"] = {};
  for (const coin of coins) groups[coin.group] = { total: (groups[coin.group]?.total ?? 0) + 1, taken: 0, missed: false };
  return {
    ...createRun(1),
    nextX: 1e9,
    hazards: hazards.map((hazard, index) => ({ top: 0, ...hazard, id: index + 1, passed: false, hit: false }) as Hazard),
    coins: coins.map((coin, index) => ({ kind: "coin" as const, ...coin, id: 100 + index, taken: false })),
    groups,
  };
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

const doubleJump = (_: RunState, frame: number) => ({ jump: frame === 0 || frame === 12, down: false });

describe("capybara run logic", () => {
  it("gives points every second", () => {
    const { state, events } = run(course([]), 120);
    expect(state.score).toBe(SECOND_POINTS * 2);
    expect(events.filter((event) => event.type === "points")).toHaveLength(2);
  });

  it("speeds up over time but never past the cap", () => {
    expect(run(course([]), 600).state.speed).toBeGreaterThan(START_SPEED);
    let state = course([]);
    for (let frame = 0; frame < 15000; frame += 1) state = step({ ...state, hearts: 3 }, IDLE).state;
    expect(state.speed).toBe(MAX_SPEED);
  });

  it.each([START_SPEED, 12, MAX_SPEED])("one single jump over a log collects every coin on its arc (speed %d)", (speed) => {
    const X = PLAYER_X + 400;
    const coins = jumpArc(X + 16, speed, 6).map(([x, y]) => ({ x, y, group: 1 }));
    const start = { ...course([{ kind: "log" as const, x: X, w: 32 }], coins), speed };
    // 아치 시작(가운데 - 점프 길이/2)에 닿으면 한 번 뛴다
    const { state } = run(start, 200, (s) => ({ jump: s.player.mode === "run" && s.distance + PLAYER_X >= X + 16 - 15.6 * s.speed && s.distance + PLAYER_X < X, down: false }));
    expect(state.coinCount).toBe(6);
    expect(state.hearts).toBe(3);
  });

  it("a single jump cannot reach the bar, a double jump grabs it and carries the capybara over the pit", () => {
    const bar = [
      { kind: "bar" as const, x: PLAYER_X - 10, w: 900 },
      { kind: "pit" as const, x: PLAYER_X + 150, w: 700 },
    ];
    const single = run(course(bar), 40, (_, frame) => ({ jump: frame === 0, down: false }));
    expect(single.events.some((event) => event.type === "grab")).toBe(false);

    const hung = run(course(bar), 30, doubleJump);
    expect(hung.events.some((event) => event.type === "double")).toBe(true);
    expect(hung.state.player.mode).toBe("hang");
    expect(hung.state.player.y - PLAYER_H).toBeGreaterThan(BAR_Y - 10);

    const after = run(hung.state, 200);
    expect(after.state.hearts).toBe(3);
    expect(after.state.player.mode).toBe("run");
    expect(after.events).toContainEqual({ type: "points", points: 120, label: "철봉 완주" });
  });

  it("falling into a pit costs a heart and respawns past it", () => {
    const { state, events } = run(course([{ kind: "pit", x: PLAYER_X + 40, w: 300 }]), 80);
    expect(events.some((event) => event.type === "fall")).toBe(true);
    expect(state.hearts).toBe(2);
    expect(state.distance + PLAYER_X).toBeGreaterThan(PLAYER_X + 340);
    expect(state.player.y).toBe(GROUND);
  });

  it("a single jump clears a short pit", () => {
    const { state } = run(course([{ kind: "pit", x: PLAYER_X + 60, w: 100 }]), 60, (_, frame) => ({ jump: frame === 6, down: false }));
    expect(state.hearts).toBe(3);
  });

  it("stairs need a double jump onto the high step", () => {
    const stairs = [
      { kind: "step" as const, x: PLAYER_X + 120, w: 210, top: GROUND - 62 },
      { kind: "step" as const, x: PLAYER_X + 330, w: 160, top: GROUND - 180 },
    ];
    // 땅에서 점프해 1층에 올라선 뒤, 1층 위에서 점프 (double이면 12프레임 뒤 한 번 더)
    const climb = (double: boolean) => {
      let jumpedOnStep = -1;
      return (state: RunState, frame: number) => {
        const onStep = state.player.mode === "run" && state.player.y === GROUND - 62;
        if (onStep && jumpedOnStep < 0) jumpedOnStep = frame;
        const jump = frame === 6 || frame === jumpedOnStep || (double && jumpedOnStep >= 0 && frame === jumpedOnStep + 12);
        return { jump, down: false };
      };
    };
    expect(run(course(stairs), 90, climb(false)).state.hearts).toBe(2);
    let stoodOnTop = false;
    const policy = climb(true);
    const doubled = run(course(stairs), 90, (state, frame) => {
      if (state.player.mode === "run" && state.player.y === GROUND - 180) stoodOnTop = true;
      return policy(state, frame);
    });
    expect(doubled.state.hearts).toBe(3);
    expect(stoodOnTop).toBe(true);
  });

  it("standing hits a branch, sliding passes under it", () => {
    const branch = [{ kind: "branch" as const, x: PLAYER_X + 100, w: 54 }];
    expect(run(course(branch), 60).state.hearts).toBe(2);
    expect(run(course(branch), 60, () => ({ jump: false, down: true })).state.hearts).toBe(3);
  });

  it("collects coins with an event each, and pays a bonus when the whole group is taken", () => {
    const coins = [0, 1, 2].map((index) => ({ x: PLAYER_X + 60 + index * 26, y: GROUND - 18, group: 1 }));
    const { state, events } = run(course([], coins), 30);
    expect(events.filter((event) => event.type === "coin")).toHaveLength(3);
    expect(events).toContainEqual({ type: "bonus", points: 3 * BONUS_PER_COIN });
    expect(state.coinCount).toBe(3);
  });

  it("no bonus when a coin of the group is missed", () => {
    const coins = [
      { x: PLAYER_X + 60, y: GROUND - 18, group: 1 },
      { x: PLAYER_X + 90, y: GROUND - 150, group: 1 },
    ];
    const { events } = run(course([], coins), 40);
    expect(events.some((event) => event.type === "bonus")).toBe(false);
  });

  it("builds the same course from the same seed, with every kind appearing over a long run", () => {
    const kinds = (seed: number) => run(createRun(seed), 1200).state.hazards.map((hazard) => [hazard.kind, Math.round(hazard.x)]);
    expect(kinds(42)).toEqual(kinds(42));
    const seen = new Set<string>();
    let state = createRun(7);
    for (let frame = 0; frame < 60 * 150; frame += 1) {
      state = step({ ...state, hearts: 3 }, IDLE).state;
      for (const hazard of state.hazards) seen.add(hazard.kind);
    }
    expect([...seen].sort()).toEqual(["bar", "branch", "fire", "log", "pit", "spring", "step", "thorn"]);
  });

  it("moves to stage 2 and 3 over time, each starting with a bonus time", () => {
    let state = course([]);
    const stages: number[] = [];
    for (let frame = 0; frame < STAGE_START[3] + 10; frame += 1) {
      const result = step({ ...state, hearts: 3 }, IDLE);
      state = result.state;
      for (const event of result.events) if (event.type === "stage") stages.push(event.stage);
      if (frame === STAGE_START[2]) expect(state.bonus).toBeGreaterThan(STAGE_BONUS_FRAMES - 5);
    }
    expect(stages).toEqual([2, 3]);
    expect(state.stage).toBe(3);
  });

  it("bonus time makes the capybara safe from hazards and pits, and doubles coins", () => {
    const start = { ...course([{ kind: "fire", x: PLAYER_X + 60, w: 80 }, { kind: "pit", x: PLAYER_X + 200, w: 300 }], [{ x: PLAYER_X + 40, y: GROUND - 18, group: 1 }]), bonus: 200 };
    const { state, events } = run(start, 70);
    expect(state.hearts).toBe(3);
    expect(events.some((event) => event.type === "fall")).toBe(false);
    expect(state.score).toBeGreaterThanOrEqual(20);
  });

  it("a star starts bonus time and a heart restores a heart", () => {
    const start = {
      ...course([]),
      hearts: 2,
      coins: [
        { id: 1, kind: "heart" as const, x: PLAYER_X + 30, y: GROUND - 18, group: 1, taken: false },
        { id: 2, kind: "star" as const, x: PLAYER_X + 90, y: GROUND - 18, group: 2, taken: false },
      ],
    };
    const { state, events } = run(start, 20);
    expect(state.hearts).toBe(3);
    expect(events.some((event) => event.type === "bonusStart")).toBe(true);
    expect(state.bonus).toBeGreaterThan(STAR_BONUS_FRAMES - 20);
  });

  it("a mushroom launches the capybara over a pit too wide to jump", () => {
    const spring = [
      { kind: "spring" as const, x: PLAYER_X + 40, w: 36 },
      { kind: "pit" as const, x: PLAYER_X + 90, w: 7 * 30 },
    ];
    const { state, events } = run({ ...course(spring), speed: 7 }, 90);
    expect(events.some((event) => event.type === "spring")).toBe(true);
    expect(state.hearts).toBe(3);
    expect(state.player.y).toBe(GROUND);
  });

  it("jumping off one bar catches the next bar over a long pit", () => {
    const bars = [
      { kind: "bar" as const, x: PLAYER_X - 10, w: 300 },
      { kind: "bar" as const, x: PLAYER_X + 290 + 50, w: 400 },
      { kind: "pit" as const, x: PLAYER_X + 150, w: 600 },
    ];
    let jumpedOff = false;
    const { state } = run({ ...course(bars), speed: 7 }, 110, (s, frame) => {
      // 첫 철봉 끝 가까이에서 뛰어내린다
      const nearEnd = s.player.mode === "hang" && s.distance + PLAYER_X > PLAYER_X + 270;
      const jump = frame === 0 || frame === 12 || (nearEnd && !jumpedOff);
      if (nearEnd) jumpedOff = true;
      return { jump, down: false };
    });
    expect(state.hearts).toBe(3);
  });
});
