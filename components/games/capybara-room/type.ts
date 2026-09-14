import type { Cell, RoomState, Stone } from "@/lib/games/rooms";
import type { RoomHandle } from "@/lib/games/use-room";
import type { ReactNode } from "react";

/** 공용 판 화면이 그리는 데 필요한 상태. 게임별 상태(GoState, GomokuState)가 이 모양을 포함한다 */
export interface BoardRoomState extends RoomState {
  size: number;
  /** y * size + x 순서의 1차원 판 */
  board: Cell[];
  lastMove: number | null;
  winner: Stone | null;
}

export interface CapybaraRoomProps<S extends BoardRoomState> {
  title: string;
  /** 시작 화면의 규칙 한 줄 */
  guide: string;
  room: RoomHandle<S>;
  /** 화점 자리(판 index) */
  starPoints: readonly number[];
  /** 강조할 자리(이긴 줄 등) */
  highlight?: readonly number[];
  turnTimeMs: number;
  stoneName: Record<Stone, string>;
  onPlay(index: number): void;
  onResign(): void;
  /** 넘기면 대국 중 패스 버튼이 생긴다 */
  onPass?(): void;
  /** 상태 카드에 덧붙일 정보(따낸 돌 등) */
  info?: ReactNode;
  /** 판이 끝났을 때 결과 팝업 설명 */
  resultText: string;
  adPlacement: string;
}
