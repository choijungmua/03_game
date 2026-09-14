import type { BotLevel } from "@/lib/games/rooms";
import type { SoundLayer } from "@/lib/lobby/settings";

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

/** 남은 시간이 이만큼(초) 되면 빨갛게 바뀌고 경고음 한 번 */
export const URGENT_SECONDS = 10;
/** 마지막 이만큼(초)은 초마다 틱 */
export const TICK_SECONDS = 5;

/** 온라인 대전 공용 화면 효과음 (playGameSound로 재생). 여러 게임이 같이 쓰는 소리는 GAME_SOUNDS에서 꺼내 쓴다 */
export const ROOM_SOUNDS = {
  /** 딩동: 상대가 방에 들어옴 */
  opponentJoined: [
    { kind: "tone", wave: "sine", from: 1047, to: 1047, ms: 180, level: 0.14 },
    { at: 170, kind: "tone", wave: "sine", from: 784, to: 784, ms: 320, level: 0.14 },
    { at: 170, kind: "tone", wave: "triangle", from: 392, to: 392, ms: 320, level: 0.05 },
  ],
  /** 뾰로롱: 초대 링크 복사됨 */
  copied: [
    { kind: "tone", wave: "sine", from: 1175, to: 1175, ms: 60, level: 0.1 },
    { at: 55, kind: "tone", wave: "sine", from: 1568, to: 1568, ms: 120, level: 0.1 },
  ],
  /** 슝↑: 이모티콘 보냄 */
  emoteSend: [
    { kind: "tone", wave: "sine", from: 500, to: 1100, ms: 110, level: 0.1 },
    { kind: "noise", filter: "bandpass", q: 1.5, from: 800, to: 2400, ms: 110, level: 0.05 },
  ],
  /** 뽁: 이모티콘 말풍선이 뜸 */
  emotePop: [
    { kind: "tone", wave: "sine", from: 420, to: 1250, ms: 90, level: 0.16 },
    { at: 80, kind: "tone", wave: "triangle", from: 1250, to: 1100, ms: 70, level: 0.06 },
  ],
  /** 뚜루↑: 끊겼던 서버 연결이 돌아옴 */
  reconnected: [
    { kind: "tone", wave: "triangle", from: 587, to: 587, ms: 80, level: 0.1 },
    { at: 80, kind: "tone", wave: "triangle", from: 880, to: 880, ms: 140, level: 0.1 },
  ],
  /** 뿅↓: 방이 사라짐 */
  gone: [
    { kind: "tone", wave: "triangle", from: 700, to: 350, ms: 180, level: 0.12 },
    { at: 170, kind: "tone", wave: "triangle", from: 440, to: 220, ms: 260, level: 0.1 },
  ],
  /** 퐁: 방 목록에 새 방이 생김 */
  roomAdded: [{ kind: "tone", wave: "sine", from: 660, to: 990, ms: 70, level: 0.07 }],
} as const satisfies Record<string, readonly SoundLayer[]>;
