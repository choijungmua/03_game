"use client";

import { useEffect, useRef } from "react";

import { CapybaraRoom } from "@/components/games/capybara-room";
import { GAME_SOUNDS, GAME_TITLES } from "@/lib/games/constants";
import type { RoomView } from "@/lib/games/rooms";
import { useRoom } from "@/lib/games/use-room";
import { playGameSound, type SoundLayer } from "@/lib/lobby/settings";

import { BADUK_SOUNDS, SOUND_GAP_MS } from "./constants";
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

// 앞 소리가 끝나고 이어지도록 여러 소리를 순서대로 이어 붙인다
function sequence(sounds: readonly (readonly SoundLayer[])[]): SoundLayer[] {
  return sounds.flatMap((layers, i) => layers.map((layer) => ({ ...layer, at: (layer.at ?? 0) + i * SOUND_GAP_MS })));
}

// 이전 화면 → 새 화면 사이에 일어난 일(돌 놓기·따내기·패스·끝남)에 맞는 소리들. 봇 응수처럼 한 응답에 두 수가 오면 차례대로 낸다
function soundsBetween(prev: RoomView<GoState>, next: RoomView<GoState>): (readonly SoundLayer[])[] {
  const { you } = next;
  const sounds: (readonly SoundLayer[])[] = [];

  // 방 만들기: 상대를 기다림 (대국 시작·상대 입장 소리는 공용 방 화면이 낸다)
  if (prev.code !== next.code) {
    return next.joined.white || next.state.endReason ? sounds : [BADUK_SOUNDS.roomOpen];
  }

  // 먼저 둘 차례였던 쪽부터
  for (const stone of [prev.state.turn, opponent(prev.state.turn)]) {
    const placed = next.state.board.some((cell, i) => cell === stone && prev.state.board[i] === null);
    if (placed) sounds.push(stone === you ? GAME_SOUNDS.place : you ? BADUK_SOUNDS.opponentPlace : GAME_SOUNDS.place);
    const captured = next.state.captures[stone] - prev.state.captures[stone];
    if (captured > 0) sounds.push(captured >= 3 ? BADUK_SOUNDS.captureMany : BADUK_SOUNDS.capture);
  }
  if (next.state.consecutivePasses > prev.state.consecutivePasses) sounds.push(BADUK_SOUNDS.pass);

  if (!prev.state.endReason && next.state.endReason) {
    if (next.state.endReason === "resign") sounds.push(BADUK_SOUNDS.resign);
    if (next.state.endReason === "timeout") sounds.push(GAME_SOUNDS.warning);
    if (next.state.endReason === "pass") sounds.push(BADUK_SOUNDS.counting, BADUK_SOUNDS.counting);
    if (!you) sounds.push(BADUK_SOUNDS.finish);
    else sounds.push(next.state.winner === you ? GAME_SOUNDS.success : GAME_SOUNDS.fail);
    return sounds;
  }

  // 대국 중 내 차례가 새로 돌아옴
  if (you && next.joined.white && !next.state.endReason && next.state.turn === you && prev.state.turn !== you) {
    sounds.push(BADUK_SOUNDS.myTurn);
  }
  return sounds;
}

export function CapybaraBaduk() {
  const room = useRoom<GoState, BadukAction>("capybara-baduk");
  const { view } = room;
  const state = view?.state;

  // 같은 화면(버전)이 다시 들어와도 한 번만 울리도록 마지막으로 소리 낸 화면을 기억한다
  const heard = useRef<RoomView<GoState> | null>(null);
  useEffect(() => {
    const prev = heard.current;
    if (!view || (prev && prev.code === view.code && prev.version >= view.version)) return;
    heard.current = view;
    // 새로고침·초대 링크로 처음 받은 화면은 이미 둔 수를 다시 울리지 않는다
    const sounds = prev ? soundsBetween(prev, view) : view.joined.white || view.state.endReason ? [] : [BADUK_SOUNDS.roomOpen];
    if (sounds.length) playGameSound(sequence(sounds));
  }, [view]);

  return (
    <CapybaraRoom
      title={GAME_TITLES["capybara-baduk"]}
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
    />
  );
}

export default CapybaraBaduk;
