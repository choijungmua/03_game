import type { SoundLayer } from "@/lib/lobby/settings";

/** 게임 표시 이름 (slug → 제목). registry와 게임 화면이 모두 여기서 꺼내 쓴다 — 이름을 바꿀 땐 여기만 고친다 */
export const GAME_TITLES = {
  "reaction-time": "반응속도 테스트",
  "click-speed": "클릭 스피드 테스트",
  "capybara-plane-shooter": "비행기 슈팅",
  "capybara-baduk": "바둑",
  "capybara-gomoku": "오목",
  "capybara-alkkagi": "알까기",
  "capybara-log-dodge": "통나무 피하기",
} as const;

/**
 * 게임 배경을 화면 끝까지 까는 층. 게임 화면은 보이는 영역(dvh)에 맞춰 버튼·HUD를 두지만,
 * 배경은 노치·홈 인디케이터·사파리 툴바 뒤까지(lvh) 채워 빈 띠가 보이지 않게 한다.
 * 색만 까는 층은 -z-10을 더해 루트 뒤에 두고, 그림 층은 그리는 순서가 그대로이게 z를 주지 않는다
 */
export const FULL_BLEED_LAYER = "pointer-events-none fixed inset-x-0 top-0 h-lvh";

/**
 * 여러 게임이 같이 쓰는 합성 효과음 (playGameSound로 재생). 음원 파일이 없어 저작권 걱정이 없다.
 * 한 게임에서만 쓰는 소리는 그 게임 폴더 constants.ts에 SoundLayer[]로 따로 둔다
 */
export const GAME_SOUNDS = {
  /** 톡: 버튼·메뉴 누름 */
  tap: [{ kind: "tone", wave: "sine", from: 900, to: 650, ms: 45, level: 0.12 }],
  /** 뚜둥↓: 일시정지 */
  pause: [
    { kind: "tone", wave: "triangle", from: 660, to: 640, ms: 90, level: 0.12 },
    { at: 90, kind: "tone", wave: "triangle", from: 440, to: 420, ms: 140, level: 0.12 },
  ],
  /** 뚜둥↑: 이어하기 */
  resume: [
    { kind: "tone", wave: "triangle", from: 440, to: 460, ms: 90, level: 0.12 },
    { at: 90, kind: "tone", wave: "triangle", from: 660, to: 680, ms: 140, level: 0.12 },
  ],
  /** 삐: 3·2·1 카운트다운 한 박 */
  countdown: [{ kind: "tone", wave: "sine", from: 660, to: 660, ms: 130, level: 0.16 }],
  /** 삐익!: 시작 신호 */
  go: [
    { kind: "tone", wave: "sine", from: 990, to: 1320, ms: 260, level: 0.16 },
    { kind: "tone", wave: "triangle", from: 495, to: 660, ms: 260, level: 0.08 },
  ],
  /** 슈욱↑: 게임 시작·새 판 */
  start: [
    { kind: "tone", wave: "triangle", from: 300, to: 900, ms: 220, level: 0.12 },
    { kind: "noise", filter: "bandpass", q: 1, from: 500, to: 2500, ms: 220, level: 0.06 },
  ],
  /** 빠밤빠밤!: 성공·승리 */
  success: [
    { kind: "tone", wave: "triangle", from: 523, to: 523, ms: 120, level: 0.14 },
    { at: 100, kind: "tone", wave: "triangle", from: 659, to: 659, ms: 120, level: 0.14 },
    { at: 200, kind: "tone", wave: "triangle", from: 784, to: 784, ms: 120, level: 0.14 },
    { at: 300, kind: "tone", wave: "triangle", from: 1047, to: 1047, ms: 420, level: 0.16 },
  ],
  /** 뿌우우↓: 실패·패배 */
  fail: [
    { kind: "tone", wave: "sawtooth", from: 392, to: 370, ms: 220, level: 0.07 },
    { at: 220, kind: "tone", wave: "sawtooth", from: 330, to: 311, ms: 220, level: 0.07 },
    { at: 440, kind: "tone", wave: "sawtooth", from: 262, to: 180, ms: 520, level: 0.07 },
  ],
  /** 반짝반짝: 신기록·순위권 */
  record: [
    { kind: "tone", wave: "sine", from: 1047, to: 1047, ms: 90, level: 0.1 },
    { at: 70, kind: "tone", wave: "sine", from: 1319, to: 1319, ms: 90, level: 0.1 },
    { at: 140, kind: "tone", wave: "sine", from: 1568, to: 1568, ms: 90, level: 0.1 },
    { at: 210, kind: "tone", wave: "sine", from: 2093, to: 2093, ms: 260, level: 0.1 },
  ],
  /** 띵동: 맞음·득점 */
  correct: [
    { kind: "tone", wave: "sine", from: 880, to: 880, ms: 100, level: 0.14 },
    { at: 90, kind: "tone", wave: "sine", from: 1320, to: 1320, ms: 200, level: 0.14 },
  ],
  /** 삐빅: 틀림·너무 빠름 */
  wrong: [{ kind: "tone", wave: "square", from: 170, to: 140, ms: 200, level: 0.09 }],
  /** 딱: 나무 알·돌을 판에 놓음 */
  place: [
    { kind: "noise", filter: "bandpass", q: 3, from: 1900, to: 1400, ms: 35, level: 0.35 },
    { kind: "tone", wave: "sine", from: 750, to: 420, ms: 50, level: 0.12 },
  ],
  /** 퍽: 부딪힘·맞음 */
  hit: [
    { kind: "noise", filter: "lowpass", q: 1, from: 1200, to: 200, ms: 110, level: 0.35 },
    { kind: "tone", wave: "sine", from: 160, to: 60, ms: 120, level: 0.16 },
  ],
  /** 콰광: 폭발·크게 부서짐 */
  explosion: [
    { kind: "noise", filter: "lowpass", q: 0.7, from: 1600, to: 90, ms: 520, level: 0.4 },
    { kind: "tone", wave: "sine", from: 120, to: 40, ms: 420, level: 0.18 },
  ],
  /** 퓽: 발사 */
  shoot: [{ kind: "tone", wave: "square", from: 1300, to: 320, ms: 90, level: 0.06 }],
  /** 띠링: 아이템·점수 먹기 */
  pickup: [
    { kind: "tone", wave: "sine", from: 988, to: 988, ms: 70, level: 0.12 },
    { at: 60, kind: "tone", wave: "sine", from: 1319, to: 1319, ms: 160, level: 0.12 },
  ],
  /** 휙: 빠르게 스쳐 지나감·튕겨 나감 */
  whoosh: [{ kind: "noise", filter: "bandpass", q: 1.2, from: 400, to: 2200, ms: 200, level: 0.18, attack: 60 }],
  /** 삐삐: 경고·곧 위험 */
  warning: [
    { kind: "tone", wave: "square", from: 880, to: 880, ms: 80, level: 0.07 },
    { at: 130, kind: "tone", wave: "square", from: 880, to: 880, ms: 80, level: 0.07 },
  ],
  /** 틱: 시계 초침·작은 카운트 */
  tick: [{ kind: "noise", filter: "highpass", q: 1, from: 3000, to: 2500, ms: 20, level: 0.15 }],
} as const satisfies Record<string, readonly SoundLayer[]>;
