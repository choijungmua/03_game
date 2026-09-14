import { describe, expect, it } from "vitest";

import { GAME_SOUNDS } from "@/lib/games/constants";
import type { RoomView, Stone } from "@/lib/games/rooms";

import { GOMOKU_SOUNDS } from "./constants";
import { createGame, type GomokuState, playMove, threatAt } from "./logic";
import { pickSounds } from "./sounds";

const at = (x: number, y: number) => y * 15 + x;

function view(state: GomokuState, you: Stone | null = "black", white = true): RoomView<GomokuState> {
  return { code: "ABCD", state, joined: { black: true, white }, you, now: 0, version: 0, emote: null, bot: true };
}

function play(state: GomokuState, ...moves: number[]) {
  return moves.reduce((current, index) => {
    const result = playMove(current, index, current.turn);
    if (!result.ok) throw new Error(result.error);
    return result.state;
  }, state);
}

// 소리 묶음의 첫 레이어 주파수로 어떤 소리인지 알아본다
const has = (layers: ReturnType<typeof pickSounds>, sound: readonly { from: number; level: number }[]) =>
  layers.some((layer) => layer.from === sound[0].from && layer.level === sound[0].level);

describe("pickSounds", () => {
  it("같은 화면이 다시 오거나 처음 받은 방은 조용", () => {
    const played = play(createGame(), at(7, 7));
    expect(pickSounds(view(played), view(played))).toEqual([]);
    expect(pickSounds(null, view(played))).toEqual([]);
  });

  it("내 수와 컴퓨터 응수가 한꺼번에 오면 두 돌 소리 + 내 차례", () => {
    const before = createGame();
    const layers = pickSounds(view(before), view(play(before, at(7, 7), at(8, 8))));
    expect(has(layers, GAME_SOUNDS.place)).toBe(true);
    expect(has(layers, GOMOKU_SOUNDS.opponentPlace)).toBe(true);
    expect(has(layers, GOMOKU_SOUNDS.myTurn)).toBe(true);
  });

  it("상대가 넷을 만들면 경고, 다섯을 이으면 줄 소리와 패배", () => {
    const four = play(createGame(), at(0, 14), at(3, 3), at(2, 14), at(4, 3), at(4, 14), at(5, 3), at(14, 0));
    const threatened = play(four, at(6, 3));
    expect(threatAt(threatened.board, 15, at(6, 3))).toBe("four");
    expect(has(pickSounds(view(four), view(threatened)), GAME_SOUNDS.warning)).toBe(true);

    const lost = play(threatened, at(14, 14), at(7, 3));
    const layers = pickSounds(view(threatened), view(lost));
    expect(has(layers, GOMOKU_SOUNDS.winLine)).toBe(true);
    expect(has(layers, GAME_SOUNDS.fail)).toBe(true);
  });
});
