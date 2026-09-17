import { describe, expect, it } from "vitest";

import {
  DANGER_GRACE_MS,
  DEADLINE_Y,
  DROP_COOLDOWN_MS,
  DROPPABLE_LEVELS,
  FRUITS,
  GAME_HEIGHT,
  GAME_OVER_MS,
  GAME_WIDTH,
  WATERMELON_BONUS,
  WATERMELON_LEVEL,
} from "./constants";
import { clampAim, createState, drop, type FruitBody, type GameEvent, type GameState, isWarning, step } from "./logic";

const zero = () => 0;

function run(state: GameState, ms: number) {
  const events: GameEvent[] = [];
  for (let t = 0; t < ms; t += 16) events.push(...step(state, 16));
  return events;
}

function body(state: GameState, level: number, x: number, y: number): FruitBody {
  const fruit = { id: state.nextId++, level, x, y, vx: 0, vy: 0, r: FRUITS[level].radius, bornAt: state.elapsedMs };
  state.fruits.push(fruit);
  return fruit;
}

describe("수박 게임 물리·규칙", () => {
  it("떨어뜨리면 들고 있던 과일이 나가고 다음 과일로 바뀌며, 잠깐은 다시 못 떨어뜨린다", () => {
    const state = createState(() => 0.99);
    expect(state.held).toBe(0);
    expect(state.next).toBe(DROPPABLE_LEVELS - 1);

    expect(drop(state, zero)).toEqual({ kind: "drop", level: 0 });
    expect(state.fruits).toHaveLength(1);
    expect(state.held).toBe(DROPPABLE_LEVELS - 1);
    expect(state.next).toBe(0);
    expect(drop(state, zero)).toBeNull();

    step(state, DROP_COOLDOWN_MS / 10);
    run(state, DROP_COOLDOWN_MS);
    expect(drop(state, zero)).not.toBeNull();
    expect(state.fruits).toHaveLength(2);
  });

  it("조준은 과일이 벽에 박히지 않는 범위로 막힌다", () => {
    expect(clampAim(-50, 3)).toBe(FRUITS[3].radius);
    expect(clampAim(GAME_WIDTH + 50, 3)).toBe(GAME_WIDTH - FRUITS[3].radius);
  });

  it("떨어진 과일은 바닥에 멈춘다", () => {
    const state = createState(zero);
    state.aimX = 100;
    drop(state, zero);
    run(state, 3000);
    const [fruit] = state.fruits;
    expect(fruit.y).toBeCloseTo(GAME_HEIGHT - fruit.r, 0);
    expect(Math.abs(fruit.vy)).toBeLessThan(5);
  });

  it("같은 과일 두 개가 닿으면 한 단계 큰 과일 하나가 되고 점수가 오른다", () => {
    const state = createState(zero);
    body(state, 2, 200, GAME_HEIGHT - 30);
    body(state, 2, 200 + FRUITS[2].radius * 2, GAME_HEIGHT - 30);
    const events = run(state, 500);
    expect(state.fruits).toHaveLength(1);
    expect(state.fruits[0].level).toBe(3);
    expect(state.score).toBe(FRUITS[3].score);
    expect(state.maxLevel).toBe(3);
    expect(events).toContainEqual(expect.objectContaining({ kind: "merge", level: 3, points: FRUITS[3].score }));
  });

  it("다른 과일끼리는 합쳐지지 않고 겹치지도 않는다", () => {
    const state = createState(zero);
    body(state, 1, 200, GAME_HEIGHT - 20);
    body(state, 2, 205, GAME_HEIGHT - 80);
    run(state, 2000);
    expect(state.fruits).toHaveLength(2);
    const [a, b] = state.fruits;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r - 1);
  });

  it("수박 두 개가 합쳐지면 사라지고 보너스 점수를 준다", () => {
    const state = createState(zero);
    const r = FRUITS[WATERMELON_LEVEL].radius;
    body(state, WATERMELON_LEVEL, r, GAME_HEIGHT - r);
    body(state, WATERMELON_LEVEL, r * 3, GAME_HEIGHT - r);
    const events = run(state, 200);
    expect(state.fruits).toHaveLength(0);
    expect(state.score).toBe(WATERMELON_BONUS);
    expect(events).toContainEqual(expect.objectContaining({ kind: "vanish" }));
  });

  it("자리 잡은 과일이 선을 넘은 채로 오래 있으면 끝난다", () => {
    const state = createState(zero);
    const fruit = body(state, 0, 100, DEADLINE_Y - 30);
    // 공중에 붙잡아 둔다: 매 프레임 되돌려 놓는다
    for (let t = 0; t < DANGER_GRACE_MS + GAME_OVER_MS + 200 && !state.over; t += 16) {
      fruit.y = DEADLINE_Y - 30;
      fruit.vy = 0;
      step(state, 16);
    }
    expect(state.over).toBe(true);
    expect(isWarning(state)).toBe(true);
  });

  it("막 떨어뜨린 과일은 선 위를 지나가도 끝나지 않는다", () => {
    const state = createState(zero);
    drop(state, zero);
    run(state, 3000);
    expect(state.over).toBe(false);
    expect(state.dangerMs).toBe(0);
  });

  it("과일을 잔뜩 쌓아도 모두 상자 안에 있다", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const state = createState(random);
    for (let i = 0; i < 40 && !state.over; i += 1) {
      state.aimX = random() * GAME_WIDTH;
      run(state, DROP_COOLDOWN_MS + 50);
      drop(state, random);
    }
    run(state, 3000);
    for (const fruit of state.fruits) {
      expect(fruit.x).toBeGreaterThanOrEqual(fruit.r - 0.5);
      expect(fruit.x).toBeLessThanOrEqual(GAME_WIDTH - fruit.r + 0.5);
      expect(fruit.y).toBeLessThanOrEqual(GAME_HEIGHT - fruit.r + 0.5);
    }
    expect(state.score).toBeGreaterThan(0);
  });
});
