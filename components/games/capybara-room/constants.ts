import type { BotLevel } from "@/lib/games/rooms";

/** 방 목록 항목의 상태 표시 */
export const ROOM_STATUS = {
  waiting: { label: "대기 중", seats: "1/2", variant: "success" },
  playing: { label: "게임 중", seats: "2/2", variant: "card" },
} as const;

/** 컴퓨터 수준 고르기 — 센 순서로 보여 준다 */
export const BOT_LEVELS: readonly { level: BotLevel; label: string }[] = [
  { level: "hard", label: "고수" },
  { level: "normal", label: "중수" },
  { level: "easy", label: "초보" },
];

/** 게임마다 브라우저에 남기는 전적 수 */
export const RECORD_LIMIT = 100;

export const NO_ROOM_IMAGE = "/assets/images/ui/rooms/no-room.webp";
