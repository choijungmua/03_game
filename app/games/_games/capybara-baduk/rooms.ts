import { createRoomStore } from "@/lib/games/rooms";

import { createGame, type GoState, passTurn, playMove, resign, timeOut, TURN_TIME_MS } from "./logic";

const BADUK_ACTIONS = ["move", "pass", "resign"] as const;
export type BadukAction = (typeof BADUK_ACTIONS)[number];

export const badukRooms = createRoomStore<GoState, BadukAction>("capybara-baduk", {
  actions: BADUK_ACTIONS,
  turnTimeMs: TURN_TIME_MS,
  create: () => createGame(),
  timeOut,
  act(state, action, seat) {
    if (action.type === "move") return playMove(state, action.index ?? -1, seat);
    if (action.type === "pass") return passTurn(state, seat);
    return resign(state, seat);
  },
});
