// @vitest-environment node
import { describe, expect, it } from "vitest";

import { BALL_R, botKeys, createGame, GROUND, KEY, NET_X, PLAYER_Y, step, type VolleyState, WIN_SCORE } from "./logic";

function run(state: VolleyState, keys: (s: VolleyState) => [number, number], frames: number) {
  for (let frame = 0; frame < frames && state.winner === null; frame += 1) state = step(state, keys(state)).state;
  return state;
}

describe("capybara volleyball logic", () => {
  it("gives the point to the side opposite where the ball lands", () => {
    const game = createGame();
    const left = { ...game, ball: { x: 100, y: GROUND - BALL_R - 1, vx: 0, vy: 3 } };
    const result = step(left, [0, 0]);
    expect(result.state.score).toEqual([0, 1]);
    expect(result.state.server).toBe(1);
    expect(result.events).toContain("point");
  });

  it("bounces the ball off the side of the net", () => {
    const game = createGame();
    const state = { ...game, ball: { x: NET_X - BALL_R - 6, y: 220, vx: 6, vy: 0 } };
    expect(step(state, [0, 0]).state.ball.vx).toBeLessThan(0);
  });

  it("spikes toward the opponent when hit is pressed in the air", () => {
    let state = createGame();
    state = { ...state, players: [{ ...state.players[0], y: PLAYER_Y - 60, vy: -2 }, state.players[1]] };
    state = step(state, [KEY.hit, 0]).state;
    const me = state.players[0];
    state = { ...state, ball: { x: me.x + 20, y: me.y - 30, vx: 0, vy: 0 } };
    const result = step(state, [KEY.hit, 0]);
    expect(result.events).toContain("spike");
    expect(result.state.ball.vx).toBeGreaterThan(10);
  });

  it("lets two bots play a full game to the winning score", () => {
    const state = run(createGame(), (s) => [botKeys(s, 0, 8), botKeys(s, 1, -8)], 60 * 60 * 30);
    expect(state.winner).not.toBeNull();
    expect(Math.max(...state.score)).toBe(WIN_SCORE);
  });

  it("bot returns a served ball at least once", () => {
    let touches = 0;
    let state = createGame(1);
    for (let frame = 0; frame < 400 && state.score[0] + state.score[1] === 0; frame += 1) {
      const result = step(state, [0, botKeys(state, 1)]);
      touches += result.events.filter((event) => event === "bump" || event === "spike").length;
      state = result.state;
    }
    expect(touches).toBeGreaterThan(0);
  });

  it("dives forward when hit is pressed on the ground", () => {
    const state = createGame();
    const result = step(state, [KEY.hit, 0]);
    expect(result.events).toContain("dive");
    const later = run(result.state, () => [KEY.hit, 0], 10);
    expect(later.players[0].x).toBeGreaterThan(state.players[0].x + 30);
  });

  it("buffers a jump pressed just before landing", () => {
    let state = createGame();
    state = { ...state, players: [{ ...state.players[0], y: PLAYER_Y - 4, vy: 3 }, state.players[1]] };
    state = step(state, [KEY.up, 0]).state;
    expect(run(state, () => [0, 0], 2).players[0].vy).toBeLessThan(0);
  });

  it("freezes a few frames after a spike lands", () => {
    let state = createGame();
    state = { ...state, players: [{ ...state.players[0], y: PLAYER_Y - 60, vy: -2 }, state.players[1]] };
    state = step(state, [KEY.hit, 0]).state;
    const me = state.players[0];
    state = step({ ...state, ball: { x: me.x + 20, y: me.y - 30, vx: 0, vy: 0 } }, [KEY.hit, 0]).state;
    expect(state.freeze).toBeGreaterThan(0);
    expect(step(state, [0, 0]).state.ball).toEqual(state.ball);
  });
});
