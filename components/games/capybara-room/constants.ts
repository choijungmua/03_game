/** 방 목록 항목의 상태 표시 */
export const ROOM_STATUS = {
  waiting: { label: "대기 중", seats: "1/2", variant: "success" },
  playing: { label: "게임 중", seats: "2/2", variant: "card" },
} as const;
