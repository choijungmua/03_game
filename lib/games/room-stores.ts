import { alkkagiRooms } from "@/app/games/_games/capybara-alkkagi/rooms";
import { badukRooms } from "@/app/games/_games/capybara-baduk/rooms";
import { gomokuRooms } from "@/app/games/_games/capybara-gomoku/rooms";

import type { RoomState, RoomStore } from "./rooms";

// 온라인 대전 게임은 여기에 한 줄씩 추가. API는 /api/games/<slug>/rooms 라우트 하나가 모두 처리한다
export const ROOM_STORES: Partial<Record<string, RoomStore<RoomState>>> = {
  "capybara-baduk": badukRooms,
  "capybara-gomoku": gomokuRooms,
  "capybara-alkkagi": alkkagiRooms,
};
