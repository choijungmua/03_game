import { createRoomStore } from "@/lib/games/rooms";

import { type AlkkagiState, createGame, resign, shoot, timeOut, TURN_TIME_MS } from "./logic";

const ALKKAGI_ACTIONS = ["shoot", "resign"] as const;
export type AlkkagiAction = (typeof ALKKAGI_ACTIONS)[number];

export const alkkagiRooms = createRoomStore<AlkkagiState, AlkkagiAction>("capybara-alkkagi", {
  actions: ALKKAGI_ACTIONS,
  turnTimeMs: TURN_TIME_MS,
  create: () => createGame(),
  timeOut,
  act(state, action, seat) {
    if (action.type === "resign") return resign(state, seat);
    if (action.index === undefined || !action.aim) return { ok: false, error: "칠 알과 방향을 정해 주세요" };
    return shoot(state, action.index, action.aim, seat);
  },
});
