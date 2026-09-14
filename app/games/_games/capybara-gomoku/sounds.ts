import { GAME_SOUNDS } from "@/lib/games/constants";
import type { RoomView } from "@/lib/games/rooms";
import type { SoundLayer } from "@/lib/lobby/settings";

import { GOMOKU_SOUNDS } from "./constants";
import { type GomokuState, threatAt } from "./logic";

/** 돌이 여러 개 한꺼번에 도착했을 때(내 수 + 컴퓨터 응수) 소리 간격 */
const STONE_GAP_MS = 180;

function later(layers: readonly SoundLayer[], ms: number): SoundLayer[] {
  return layers.map((layer) => ({ ...layer, at: (layer.at ?? 0) + ms }));
}

/** 방 화면이 prev → next로 바뀔 때 낼 소리 (재생은 화면에서). 폴링마다 불려도 바뀐 것만 소리 낸다 */
export function pickSounds(prev: RoomView<GomokuState> | null, next: RoomView<GomokuState> | null): SoundLayer[] {
  if (!next) return [];
  const { state, you } = next;
  const sameRoom = prev !== null && prev.code === next.code;
  const layers: SoundLayer[] = [];

  // 처음 받은 방은 이미 둔 수를 다시 울리지 않는다 (대국 시작 소리는 공용 CapybaraRoom이 낸다)
  if (!sameRoom) return layers;

  // 새로 놓인 돌. 먼저 둔 쪽(prev 차례) 돌부터
  const placed = state.board
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell, index }) => cell !== null && prev.state.board[index] === null)
    .sort((a, b) => Number(a.cell !== prev.state.turn) - Number(b.cell !== prev.state.turn));
  placed.forEach(({ cell }, i) => {
    const mine = you ? cell === you : cell === "black";
    layers.push(...later(mine ? GAME_SOUNDS.place : GOMOKU_SOUNDS.opponentPlace, i * STONE_GAP_MS));
  });
  let at = Math.max(0, placed.length - 1) * STONE_GAP_MS;

  // 위협 경고: 마지막 돌이 넷·열린 셋을 만들었는지 (관전자는 넷만 반짝)
  let warned = false;
  if (placed.length > 0 && !state.endReason && state.lastMove !== null) {
    const threat = threatAt(state.board, state.size, state.lastMove);
    const mine = state.board[state.lastMove] === you;
    const sound =
      threat === "four" ? (mine || !you ? GOMOKU_SOUNDS.chanceFour : GAME_SOUNDS.warning)
      : threat === "three" && you && !mine ? GOMOKU_SOUNDS.threatThree
      : null;
    if (sound) {
      layers.push(...later(sound, at + 120));
      warned = true;
    }
  }

  // 상대가 둬서 내 차례가 됨 (경고가 울렸으면 겹치지 않게 생략)
  // (내 수와 컴퓨터 응수가 한 응답에 같이 오면 prev도 내 차례라, 상대 돌이 놓였는지로 본다)
  if (you && !state.endReason && state.turn === you && placed.some(({ cell }) => cell !== you) && !warned) {
    layers.push(...later(GOMOKU_SOUNDS.myTurn, at + 300));
  }

  // 대국 끝: 다섯 줄이면 줄 빛나는 소리 뒤에 결과
  if (!prev.state.endReason && state.endReason) {
    if (state.endReason === "five") {
      layers.push(...later(GOMOKU_SOUNDS.winLine, at + 120));
      at += 450;
    } else {
      at += placed.length > 0 ? 150 : 0;
    }
    const result =
      !state.winner ? GOMOKU_SOUNDS.draw
      : !you ? GAME_SOUNDS.correct
      : state.winner === you ? GAME_SOUNDS.success
      : GAME_SOUNDS.fail;
    layers.push(...later(result, at));
  }

  return layers;
}
