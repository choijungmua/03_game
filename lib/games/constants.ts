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
  "capybara-pang": "바라매치",
  "watermelon-game": "수박 게임",
  "capybara-volleyball": "카피바라 배구",
  "capybara-run": "카피바라 런",
} as const;

/** 로비 맵에 오두막 없이 왼쪽 위 "게임 목록"에서만 고르는 게임 (마을 테마와 안 맞음). 게임 페이지·검색 노출은 그대로 */
export const LIST_ONLY_GAMES: readonly string[] = [
  "reaction-time",
  "click-speed",
  "capybara-baduk",
];

/**
 * 게임 배경을 화면 끝까지 까는 층. 게임 화면은 보이는 영역(dvh)에 맞춰 버튼·HUD를 두지만,
 * 배경은 노치·홈 인디케이터·사파리 툴바 뒤까지(lvh) 채워 빈 띠가 보이지 않게 한다.
 * 색만 까는 층은 -z-10을 더해 루트 뒤에 두고, 그림 층은 그리는 순서가 그대로이게 z를 주지 않는다
 */
export const FULL_BLEED_LAYER = "pointer-events-none fixed inset-x-0 top-0 h-lvh";

/**
 * 여러 게임이 같이 쓰는 효과음 (playGameSound로 재생). 실제 재질 소리(나무·물·공기)를 합성으로 흉내 내고,
 * 마림바·칼림바 같은 FM 타악기 음색과 카피바라 목소리(public/sfx/voice)를 얹어 이 사이트만의 소리를 만든다.
 * 한 게임에서만 쓰는 소리는 그 게임 폴더 constants.ts에 SoundLayer[]로 따로 둔다
 */
export const GAME_SOUNDS = {
  /** 톡: 버튼·메뉴 누름 — 나무 블록을 손끝으로 두드린 소리 */
  tap: [
    { kind: "tone", wave: "sine", from: 1180, to: 1100, ms: 70, level: 0.11, attack: 2, fm: { ratio: 2.76, index: 0.6 }, wet: 0.06 },
    { kind: "noise", filter: "bandpass", q: 6, from: 3200, to: 2600, ms: 18, level: 0.08, attack: 1, wet: 0 },
  ],
  /** 뚜둥↓: 일시정지 — 칼림바 두 음이 내려간다 */
  pause: [
    { kind: "tone", wave: "sine", from: 784, to: 780, ms: 220, level: 0.12, attack: 2, fm: { ratio: 3.5, index: 0.5 } },
    { at: 90, kind: "tone", wave: "sine", from: 523, to: 520, ms: 320, level: 0.12, attack: 2, fm: { ratio: 3.5, index: 0.5 } },
  ],
  /** 뚜둥↑: 이어하기 */
  resume: [
    { kind: "tone", wave: "sine", from: 523, to: 524, ms: 220, level: 0.12, attack: 2, fm: { ratio: 3.5, index: 0.5 } },
    { at: 90, kind: "tone", wave: "sine", from: 784, to: 786, ms: 320, level: 0.12, attack: 2, fm: { ratio: 3.5, index: 0.5 } },
  ],
  /** 똑: 3·2·1 카운트다운 한 박 (목소리까지 넣으려면 countdownSound) — 우드블록 */
  countdown: [
    { kind: "tone", wave: "sine", from: 880, to: 860, ms: 160, level: 0.15, attack: 2, fm: { ratio: 2.76, index: 0.9 } },
    { kind: "noise", filter: "bandpass", q: 5, from: 2400, to: 1800, ms: 25, level: 0.1, attack: 1, wet: 0 },
  ],
  /** 시작!: 출발 신호 — 카피바라가 외치고 밝은 화음이 열린다 */
  go: [
    { kind: "voice", line: "go", from: 9000, to: 7000, ms: 600, level: 0.85 },
    { kind: "tone", wave: "sawtooth", from: 523, to: 523, ms: 420, level: 0.05, detune: 12, lowpass: 3800 },
    { kind: "tone", wave: "sawtooth", from: 659, to: 659, ms: 420, level: 0.05, detune: 12, lowpass: 3800 },
    { kind: "tone", wave: "sawtooth", from: 784, to: 784, ms: 420, level: 0.05, detune: 12, lowpass: 3800 },
    { kind: "noise", filter: "highpass", q: 0.7, from: 5000, to: 9000, ms: 300, level: 0.05, attack: 40, color: "pink" },
  ],
  /** 슈욱↑: 게임 시작·새 판 — 공기가 빨려 올라가는 라이저 + 반짝임 */
  start: [
    { kind: "noise", filter: "bandpass", q: 1.4, from: 400, to: 4200, ms: 280, level: 0.14, attack: 120, color: "pink" },
    { kind: "tone", wave: "triangle", from: 330, to: 990, ms: 260, level: 0.08, detune: 8, lowpass: 5000 },
    { at: 230, kind: "tone", wave: "sine", from: 1568, to: 1568, ms: 300, level: 0.07, attack: 2, fm: { ratio: 3.5, index: 0.4 }, wet: 0.3 },
  ],
  /** 이겼다!: 성공·승리 — 마림바 아르페지오 + 환호 */
  success: [
    { kind: "tone", wave: "sine", from: 523, to: 523, ms: 260, level: 0.13, attack: 2, fm: { ratio: 4, index: 0.7 }, pan: -0.3 },
    { at: 90, kind: "tone", wave: "sine", from: 659, to: 659, ms: 260, level: 0.13, attack: 2, fm: { ratio: 4, index: 0.7 }, pan: -0.1 },
    { at: 180, kind: "tone", wave: "sine", from: 784, to: 784, ms: 260, level: 0.13, attack: 2, fm: { ratio: 4, index: 0.7 }, pan: 0.1 },
    { at: 270, kind: "tone", wave: "sine", from: 1047, to: 1047, ms: 700, level: 0.15, attack: 2, fm: { ratio: 4, index: 0.7 }, pan: 0.3, wet: 0.3 },
    { at: 270, kind: "tone", wave: "sawtooth", from: 523, to: 523, ms: 700, level: 0.03, detune: 14, lowpass: 2600 },
    { at: 380, kind: "voice", line: "win", from: 9000, to: 6000, ms: 800, level: 0.8 },
  ],
  /** 아이고: 실패·패배 — 힘 빠진 튜바 같은 하강 + 한숨 섞인 목소리 */
  fail: [
    { kind: "tone", wave: "sawtooth", from: 392, to: 380, ms: 260, level: 0.06, detune: 10, lowpass: 1400 },
    { at: 230, kind: "tone", wave: "sawtooth", from: 330, to: 318, ms: 260, level: 0.06, detune: 10, lowpass: 1200 },
    { at: 460, kind: "tone", wave: "sawtooth", from: 262, to: 180, ms: 600, level: 0.06, detune: 10, lowpass: 1000 },
    { at: 300, kind: "voice", line: "lose", from: 9000, to: 8000, ms: 800, level: 0.75 },
  ],
  /** 신기록!: 신기록·순위권 — 종소리가 쏟아지고 외친다 */
  record: [
    { kind: "tone", wave: "sine", from: 1047, to: 1047, ms: 400, level: 0.08, attack: 2, fm: { ratio: 3.5, index: 0.6 }, pan: -0.5, wet: 0.35 },
    { at: 70, kind: "tone", wave: "sine", from: 1319, to: 1319, ms: 400, level: 0.08, attack: 2, fm: { ratio: 3.5, index: 0.6 }, pan: -0.15, wet: 0.35 },
    { at: 140, kind: "tone", wave: "sine", from: 1568, to: 1568, ms: 400, level: 0.08, attack: 2, fm: { ratio: 3.5, index: 0.6 }, pan: 0.15, wet: 0.35 },
    { at: 210, kind: "tone", wave: "sine", from: 2093, to: 2093, ms: 700, level: 0.09, attack: 2, fm: { ratio: 3.5, index: 0.6 }, pan: 0.5, wet: 0.4 },
    { at: 260, kind: "voice", line: "record", from: 10000, to: 8000, ms: 700, level: 0.8 },
  ],
  /** 띵동: 맞음·득점 — 칼림바 두 음 */
  correct: [
    { kind: "tone", wave: "sine", from: 880, to: 880, ms: 180, level: 0.13, attack: 2, fm: { ratio: 3.5, index: 0.5 } },
    { at: 80, kind: "tone", wave: "sine", from: 1319, to: 1319, ms: 320, level: 0.13, attack: 2, fm: { ratio: 3.5, index: 0.5 }, wet: 0.2 },
  ],
  /** 뿌웅: 틀림·너무 빠름 — 둔탁한 베이스 버저 (날카로운 삐빅 대신) */
  wrong: [
    { kind: "tone", wave: "sawtooth", from: 196, to: 150, ms: 240, level: 0.09, detune: 18, lowpass: 900 },
    { kind: "tone", wave: "sine", from: 98, to: 75, ms: 240, level: 0.12 },
  ],
  /** 딱: 나무 알·돌을 판에 놓음 — 단단한 클릭 + 판 울림 */
  place: [
    { kind: "noise", filter: "bandpass", q: 4, from: 2600, to: 1600, ms: 30, level: 0.32, attack: 1, wet: 0.05 },
    { kind: "tone", wave: "sine", from: 620, to: 560, ms: 90, level: 0.12, attack: 1, fm: { ratio: 2.76, index: 0.8 } },
    { kind: "tone", wave: "sine", from: 170, to: 120, ms: 70, level: 0.08, attack: 1 },
  ],
  /** 퍽: 부딪힘·맞음 — 둔한 몸통 타격 + 저음 펀치 */
  hit: [
    { kind: "noise", filter: "lowpass", q: 1, from: 2400, to: 300, ms: 120, level: 0.32, attack: 1, color: "pink" },
    { kind: "tone", wave: "sine", from: 180, to: 55, ms: 150, level: 0.2, attack: 1 },
    { kind: "noise", filter: "bandpass", q: 3, from: 900, to: 500, ms: 40, level: 0.12, attack: 1, wet: 0 },
  ],
  /** 콰광: 폭발·크게 부서짐 — 바위 무너지는 저역 + 파편 */
  explosion: [
    { kind: "noise", filter: "lowpass", q: 0.7, from: 2200, to: 80, ms: 700, level: 0.4, attack: 2, color: "brown", wet: 0.3 },
    { kind: "tone", wave: "sine", from: 110, to: 32, ms: 550, level: 0.24, attack: 2 },
    { kind: "noise", filter: "highpass", q: 0.7, from: 4000, to: 1500, ms: 260, level: 0.1, attack: 1, pan: 0.3 },
  ],
  /** 퓻: 발사 — 공기 압축이 빠지는 소리 */
  shoot: [
    { kind: "noise", filter: "bandpass", q: 2.5, from: 3800, to: 900, ms: 80, level: 0.12, attack: 1, color: "pink", wet: 0.05 },
    { kind: "tone", wave: "triangle", from: 1400, to: 420, ms: 70, level: 0.06, attack: 1 },
  ],
  /** 띠링: 아이템·점수 먹기 — 물방울 + 칼림바 */
  pickup: [
    { kind: "tone", wave: "sine", from: 600, to: 1400, ms: 70, level: 0.1, attack: 1 },
    { at: 50, kind: "tone", wave: "sine", from: 1319, to: 1319, ms: 260, level: 0.12, attack: 2, fm: { ratio: 3.5, index: 0.5 }, wet: 0.25 },
  ],
  /** 휙: 빠르게 스쳐 지나감·튕겨 나감 — 바람 가르는 소리, 왼쪽에서 오른쪽으로 */
  whoosh: [
    { kind: "noise", filter: "bandpass", q: 1.6, from: 350, to: 2600, ms: 220, level: 0.2, attack: 80, color: "pink", pan: -0.4 },
    { at: 60, kind: "noise", filter: "bandpass", q: 1.6, from: 600, to: 3200, ms: 180, level: 0.12, attack: 60, color: "pink", pan: 0.4 },
  ],
  /** 조심해!: 경고·곧 위험 — 두 번 울리는 경보 + 목소리 */
  warning: [
    { kind: "tone", wave: "sawtooth", from: 740, to: 740, ms: 110, level: 0.05, detune: 15, lowpass: 3000 },
    { at: 150, kind: "tone", wave: "sawtooth", from: 740, to: 740, ms: 110, level: 0.05, detune: 15, lowpass: 3000 },
    { at: 300, kind: "voice", line: "careful", from: 8000, to: 6000, ms: 700, level: 0.7 },
  ],
  /** 틱: 시계 초침·작은 카운트 */
  tick: [
    { kind: "noise", filter: "bandpass", q: 8, from: 4200, to: 3800, ms: 16, level: 0.16, attack: 1, wet: 0 },
    { kind: "tone", wave: "sine", from: 2100, to: 2000, ms: 25, level: 0.04, attack: 1 },
  ],
  /** 좋아!: 콤보·잘했음 칭찬 */
  praise: [
    { kind: "tone", wave: "sine", from: 1047, to: 1047, ms: 240, level: 0.09, attack: 2, fm: { ratio: 3.5, index: 0.5 } },
    { at: 40, kind: "voice", line: "nice", from: 9000, to: 7000, ms: 600, level: 0.75 },
  ],
  /** 대박!: 크게 터짐(전설 등급·큰 연쇄) */
  jackpot: [
    { kind: "noise", filter: "highpass", q: 0.7, from: 3000, to: 8000, ms: 400, level: 0.08, attack: 30, color: "pink", wet: 0.4 },
    { kind: "tone", wave: "sine", from: 1568, to: 1568, ms: 500, level: 0.09, attack: 2, fm: { ratio: 3.5, index: 0.7 }, pan: -0.3, wet: 0.4 },
    { at: 60, kind: "tone", wave: "sine", from: 2093, to: 2093, ms: 500, level: 0.09, attack: 2, fm: { ratio: 3.5, index: 0.7 }, pan: 0.3, wet: 0.4 },
    { at: 90, kind: "voice", line: "wow", from: 10000, to: 8000, ms: 600, level: 0.85 },
  ],
  /** 아야!: 맞았을 때 (hit와 함께) */
  ouch: [{ kind: "voice", line: "ouch", from: 8000, to: 5000, ms: 500, level: 0.7 }],
  /** 끝!: 시간 종료 — 징 + 목소리 */
  timeUp: [
    { kind: "tone", wave: "sine", from: 660, to: 655, ms: 500, level: 0.12, attack: 2, fm: { ratio: 1.4, index: 1.2 }, wet: 0.35 },
    { kind: "voice", line: "timeup", from: 9000, to: 6000, ms: 500, level: 0.8 },
  ],
  /** 내 차례!: 상대가 두고 내 턴이 옴 */
  myTurn: [
    { kind: "tone", wave: "sine", from: 988, to: 988, ms: 200, level: 0.1, attack: 2, fm: { ratio: 3.5, index: 0.5 } },
    { at: 60, kind: "voice", line: "myturn", from: 9000, to: 7000, ms: 600, level: 0.7 },
  ],
  /** 레벨 업!: 단계 오름 */
  levelUp: [
    { kind: "tone", wave: "sawtooth", from: 392, to: 784, ms: 300, level: 0.05, detune: 12, lowpass: 4000 },
    { at: 250, kind: "tone", wave: "sine", from: 1568, to: 1568, ms: 400, level: 0.09, attack: 2, fm: { ratio: 3.5, index: 0.6 }, wet: 0.3 },
    { at: 200, kind: "voice", line: "levelup", from: 9000, to: 7000, ms: 700, level: 0.8 },
  ],
  /** 서둘러!: 남은 시간이 얼마 없음 */
  hurry: [{ kind: "voice", line: "hurry", from: 8000, to: 6000, ms: 600, level: 0.75 }],
  /** 얍!: 점프·힘주기 기합 */
  hup: [{ kind: "voice", line: "hup", from: 8000, to: 6000, ms: 300, level: 0.55 }],
  /** 잡았다!: 큰 걸 손에 넣음 */
  gotIt: [{ kind: "voice", line: "gotit", from: 9000, to: 7000, ms: 600, level: 0.75 }],
  /** 우와!: 놀라운 일(보스 등장·큰 보상) */
  woah: [{ kind: "voice", line: "woah", from: 9000, to: 7000, ms: 500, level: 0.75 }],
  /** 앗!: 아깝게 놓침 */
  oops: [{ kind: "voice", line: "oops", from: 8000, to: 6000, ms: 400, level: 0.7 }],
} as const satisfies Record<string, readonly SoundLayer[]>;

const COUNTDOWN_VOICES = { 3: "three", 2: "two", 1: "one" } as const;

/** 3·2·1 카운트다운 한 박: 우드블록에 "셋·둘·하나" 목소리를 얹는다 (그 밖의 숫자는 우드블록만) */
export function countdownSound(left: number): readonly SoundLayer[] {
  const line = COUNTDOWN_VOICES[left as keyof typeof COUNTDOWN_VOICES];
  return line ? [...GAME_SOUNDS.countdown, { kind: "voice", line, from: 9000, to: 7000, ms: 500, level: 0.8 }] : GAME_SOUNDS.countdown;
}
