import type { LobbySettings, LobbySound } from "./settings";

/** 이모지를 이어 붙이는 보이지 않는 문자(ZWJ). 지우면 가족·직업 이모지 같은 조합 이모지가 낱개로 흩어진다 (보이지 않는 글자라 코드값으로 쓴다) */
export const ZWJ = String.fromCharCode(0x200d);

export const DEFAULT_LOBBY_SETTINGS: LobbySettings = { muted: false, volume: 0.6, showHelp: true };

export const LOBBY_SETTINGS_STORAGE_KEY = "ggpli:lobby-settings";

/** 효과음 파일 없이 오실레이터로 합성하는 짧은 소리들 (주파수 Hz, 길이 ms, 최대 크기 0~1) */
export const SOUND_TONES: Record<LobbySound, { wave: OscillatorType; from: number; to: number; ms: number; level: number }> = {
  chat: { wave: "sine", from: 740, to: 1180, ms: 120, level: 0.18 },
  swing: { wave: "triangle", from: 420, to: 140, ms: 140, level: 0.16 },
  hit: { wave: "square", from: 180, to: 55, ms: 200, level: 0.12 },
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
