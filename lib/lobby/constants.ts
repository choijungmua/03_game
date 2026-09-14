import type { LobbySettings, LobbySound, SoundLayer } from "./settings";

/** 이모지를 이어 붙이는 보이지 않는 문자(ZWJ). 지우면 가족·직업 이모지 같은 조합 이모지가 낱개로 흩어진다 (보이지 않는 글자라 코드값으로 쓴다) */
export const ZWJ = String.fromCharCode(0x200d);

export const DEFAULT_LOBBY_SETTINGS: LobbySettings = { muted: false, volume: 0.6, showHelp: true };

export const LOBBY_SETTINGS_STORAGE_KEY = "ggpli:lobby-settings";

/** 다른 유저는 이만큼 과거 위치를 그린다. 폴링(150ms)이 한 번 늦어도 멈칫하지 않게 두 틱이 조금 안 되게 둔다 */
export const REMOTE_RENDER_DELAY_MS = 250;
/** 응답에서 이만큼 계속 빠진 유저만 지운다. 한 번 빠졌다고 지우면 사라졌다 다시 나타나 깜빡인다 */
export const REMOTE_GONE_MS = 1_000;
/** 유저마다 들고 있는 과거 위치 개수 */
export const MAX_SNAPSHOTS = 8;
/** 이보다 오래 같은 자리에 있다가 움직이면, 서 있던 시간에 걸쳐 느리게 오지 않고 한 틱 동안 걷게 한다 */
export const SNAPSHOT_RESTART_MS = 500;

/** 효과음 파일 없이 오실레이터(tone)·걸러낸 잡음(noise)을 겹쳐 합성하는 짧은 소리들 (주파수 Hz, 길이·시작 ms, 최대 크기 0~1) */
export const SOUNDS: Record<LobbySound, readonly SoundLayer[]> = {
  chat: [{ kind: "tone", wave: "sine", from: 740, to: 1180, ms: 120, level: 0.18 }],
  swing: [{ kind: "tone", wave: "triangle", from: 420, to: 140, ms: 140, level: 0.16 }],
  hit: [{ kind: "tone", wave: "square", from: 180, to: 55, ms: 200, level: 0.12 }],
  // 사각: 풀밭을 밟는 낮고 부드러운 발소리 + 풀잎 스치는 소리
  step: [
    { kind: "noise", filter: "lowpass", q: 1, from: 900, to: 250, ms: 70, level: 0.18 },
    { kind: "tone", wave: "sine", from: 120, to: 70, ms: 60, level: 0.08 },
    { kind: "noise", filter: "bandpass", q: 0.8, from: 3200, to: 2000, ms: 110, level: 0.08, attack: 15 },
  ],
  // 통: 나무 데크 판자를 밟는 속 빈 나무 울림
  stepDeck: [
    { kind: "noise", filter: "bandpass", q: 4, from: 900, to: 700, ms: 40, level: 0.3 },
    { kind: "tone", wave: "triangle", from: 320, to: 260, ms: 80, level: 0.12 },
    { at: 8, kind: "tone", wave: "sine", from: 640, to: 560, ms: 50, level: 0.05 },
  ],
  // 철퍽: 진흙길을 밟는 질척한 소리
  stepMud: [
    { kind: "noise", filter: "lowpass", q: 2, from: 400, to: 900, ms: 90, level: 0.22 },
    { kind: "tone", wave: "sine", from: 90, to: 60, ms: 70, level: 0.1 },
  ],
  // 뿅 → 털썩: 폴짝 뛰어올라 통나무에 엉덩이를 붙인다
  sit: [
    { kind: "tone", wave: "sine", from: 520, to: 160, ms: 150, level: 0.18 },
    { at: 120, kind: "noise", filter: "lowpass", q: 1, from: 700, to: 200, ms: 100, level: 0.3 },
    { at: 120, kind: "tone", wave: "sine", from: 110, to: 60, ms: 90, level: 0.14 },
  ],
  // 하아~암: 천천히 올라갔다 길게 내려오는 목소리 + 숨소리
  yawn: [
    { kind: "tone", wave: "triangle", from: 240, to: 420, ms: 550, level: 0.1, attack: 180 },
    { at: 450, kind: "tone", wave: "triangle", from: 420, to: 170, ms: 850, level: 0.1, attack: 80 },
    { kind: "noise", filter: "bandpass", q: 0.8, from: 1000, to: 600, ms: 1200, level: 0.05, attack: 300 },
  ],
  // 슥슥: 털을 긁는 짧고 까슬한 소리 두 번
  scratch: [
    { kind: "noise", filter: "bandpass", q: 1.5, from: 2600, to: 1800, ms: 90, level: 0.16 },
    { at: 70, kind: "noise", filter: "bandpass", q: 1.5, from: 2200, to: 1500, ms: 80, level: 0.12 },
  ],
  // 아삭 쩝: 수박을 크게 베어 무는 바삭한 소리 + 과즙이 톡 튀는 소리
  chomp: [
    { kind: "noise", filter: "highpass", q: 0.7, from: 3800, to: 1800, ms: 45, level: 0.4 },
    { at: 30, kind: "noise", filter: "bandpass", q: 1.2, from: 2600, to: 900, ms: 75, level: 0.32 },
    { at: 10, kind: "tone", wave: "sine", from: 230, to: 110, ms: 70, level: 0.16 },
    { at: 95, kind: "tone", wave: "sine", from: 1300, to: 700, ms: 35, level: 0.05 },
  ],
  // 헉!: 깜짝 놀라 치솟았다가 털썩 내려앉는 소리
  caught: [
    { kind: "tone", wave: "square", from: 320, to: 900, ms: 110, level: 0.1 },
    { at: 130, kind: "tone", wave: "sawtooth", from: 700, to: 140, ms: 480, level: 0.09 },
    { at: 130, kind: "noise", filter: "lowpass", q: 1, from: 600, to: 150, ms: 220, level: 0.25 },
  ],
};

/** 로비 플레이어 이름표 = 꾸밈말 + 이름 ("졸린 치킨바라"). 서버가 입장할 때 접속 중인 사람과 안 겹치게 고른다 (presence.ts pickName)
 * 조합 수(꾸밈말×이름 = 960)가 presence.ts MAX_PLAYERS(500)보다 커야 늘 빈 이름이 있다 — 줄일 때 주의 */
export const CAPYBARA_ADJECTIVES = [
  "졸린", "배고픈", "신난", "보들보들", "나른한", "수줍은", "용감한", "동글동글", "따끈한", "해맑은",
  "꾸벅꾸벅", "뒤뚱뒤뚱", "촉촉한", "포근한", "씩씩한", "새침한", "엉뚱한", "설레는", "심심한", "궁금한",
] as const;

export const CAPYBARA_NAMES = [
  "이기길바라", "행복하길바라", "부자되길바라", "잘되길바라", "꿀잠자길바라", "로또되길바라", "합격하길바라", "칼퇴하길바라",
  "월급오르길바라", "사랑받길바라", "건강하길바라", "주말이길바라", "방학이길바라", "눈오길바라", "치킨바라", "피자바라",
  "떡볶이바라", "붕어빵바라", "호떡바라", "라면바라", "김밥바라", "만두바라", "치즈바라", "초코바라",
  "젤리바라", "푸딩바라", "딸기바라", "수박바라", "귤바라", "유자바라", "꿀바라", "온천바라",
  "낮잠바라", "멍때리바라", "뒹굴바라", "느긋바라", "말랑바라", "뽀짝바라", "몽글바라", "쫀득바라",
  "반짝바라", "두근바라", "콩닥바라", "바라바라", "원조카피바라", "마라바라", "솜사탕바라", "팥빙수바라",
] as const;
