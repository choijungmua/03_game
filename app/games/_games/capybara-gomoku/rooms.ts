import { createRoomStore } from "@/lib/games/rooms";

import { createGame, type GomokuState, playMove, resign, timeOut, TURN_TIME_MS } from "./logic";

const GOMOKU_ACTIONS = ["move", "resign"] as const;
export type GomokuAction = (typeof GOMOKU_ACTIONS)[number];

export const gomokuRooms = createRoomStore<GomokuState, GomokuAction>("capybara-gomoku", {
  actions: GOMOKU_ACTIONS,
  turnTimeMs: TURN_TIME_MS,
  create: () => createGame(),
  timeOut,
  act(state, action, seat) {
    if (action.type === "move") return playMove(state, action.index ?? -1, seat);
    return resign(state, seat);
  },
});
