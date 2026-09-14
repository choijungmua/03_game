"use client";

import { CapybaraRoom } from "@/components/games/capybara-room";
import { GAME_TITLES } from "@/lib/games/constants";
import { opponent, type Stone } from "@/lib/games/rooms";
import { useRoom } from "@/lib/games/use-room";

import { BOARD_SIZE, type GomokuState, TURN_TIME_MS } from "./logic";
import type { GomokuAction } from "./rooms";

const STONE_NAME: Record<Stone, string> = { black: "갈색 카피바라", white: "흰 카피바라" };
const STAR_POINTS = [3, 7, 11].flatMap((y) => [3, 7, 11].map((x) => y * BOARD_SIZE + x));

function describeEnd(state: GomokuState) {
  if (!state.winner) return "판이 가득 차서 무승부예요.";
  const loser = STONE_NAME[opponent(state.winner)];
  if (state.endReason === "resign") return `${loser}가 기권했어요.`;
  if (state.endReason === "timeout") return `${loser}가 제한시간을 넘겼어요.`;
  return `${STONE_NAME[state.winner]}가 ${state.winLine.length}마리를 한 줄로 이었어요.`;
}

export function CapybaraGomoku() {
  const room = useRoom<GomokuState, GomokuAction>("capybara-gomoku");
  const state = room.view?.state;

  return (
    <CapybaraRoom
      title={GAME_TITLES["capybara-gomoku"]}
      guide={`친구를 초대하거나 컴퓨터와 둬서 카피바라 다섯 마리를 먼저 한 줄로 이으면 이겨요. 한 수에 ${TURN_TIME_MS / 1000}초`}
      room={room}
      starPoints={STAR_POINTS}
      highlight={state?.winLine}
      turnTimeMs={TURN_TIME_MS}
      stoneName={STONE_NAME}
      onPlay={(index) => room.act("move", index)}
      onResign={() => room.act("resign")}
      resultText={state?.endReason ? describeEnd(state) : ""}
      adPlacement="capybara-gomoku-result"
    />
  );
}

export default CapybaraGomoku;
