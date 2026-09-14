"use client";

import { CapybaraRoom } from "@/components/games/capybara-room";
import { useRoom } from "@/lib/games/use-room";

import { BOARD_SIZE, type GoState, KOMI, opponent, type Stone, TURN_TIME_MS } from "./logic";
import type { BadukAction } from "./rooms";

const STONE_NAME: Record<Stone, string> = { black: "갈색 카피바라", white: "흰 카피바라" };
// 9줄 판 화점: 네 귀(3-3)와 천원
const STAR_POINTS = [
  [2, 2],
  [6, 2],
  [4, 4],
  [2, 6],
  [6, 6],
].map(([x, y]) => y * BOARD_SIZE + x);

function describeEnd(state: GoState) {
  if (!state.winner) return "";
  const loser = STONE_NAME[opponent(state.winner)];
  if (state.endReason === "resign") return `${loser}가 기권했어요.`;
  if (state.endReason === "timeout") return `${loser}가 제한시간을 넘겼어요.`;
  return `계가 갈색 ${state.finalScore?.black} : 흰색 ${state.finalScore?.white} (덤 ${KOMI} 포함)`;
}

export function CapybaraBaduk() {
  const room = useRoom<GoState, BadukAction>("capybara-baduk");
  const state = room.view?.state;

  return (
    <CapybaraRoom
      title="카피바라 바둑"
      guide={`친구를 초대하거나 컴퓨터와 둬서 9줄 판에서 집을 더 많이 지으면 이겨요. 한 수에 ${TURN_TIME_MS / 1000}초`}
      room={room}
      starPoints={STAR_POINTS}
      turnTimeMs={TURN_TIME_MS}
      stoneName={STONE_NAME}
      onPlay={(index) => room.act("move", index)}
      onPass={() => room.act("pass")}
      onResign={() => room.act("resign")}
      info={
        state && (
          <span>
            따낸 돌 갈색 {state.captures.black} · 흰색 {state.captures.white}
            {state.consecutivePasses > 0 && !state.endReason && ` · ${STONE_NAME[opponent(state.turn)]}가 패스`}
          </span>
        )
      }
      resultText={state?.endReason ? describeEnd(state) : ""}
      adPlacement="capybara-baduk-result"
    />
  );
}

export default CapybaraBaduk;
