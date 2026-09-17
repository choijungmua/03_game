import type { SoundLayer } from "@/lib/lobby/settings";

/** 게임 좌표계(캔버스 논리 크기). 화면에는 이 비율 그대로 들어가는 최대 크기로 그린다 */
export const GAME_WIDTH = 420;
export const GAME_HEIGHT = 700;
/** 들고 있는 과일이 매달린 높이 — 위쪽 뒤로·일시정지 버튼과 점수 HUD 아래 */
export const DROP_Y = 140;
/** 과일 윗면이 이 선을 넘은 채로 GAME_OVER_MS 동안 있으면 끝 */
export const DEADLINE_Y = 190;
/** 선 가까이(이 거리 안) 쌓이면 경고선이 깜빡이기 시작한다 */
export const WARNING_MARGIN = 50;
export const GAME_OVER_MS = 2000;
/** 막 떨어뜨렸거나 방금 합쳐진 과일은 이 시간 동안 선을 넘어도 세지 않는다 (떨어지는 중이니까) */
export const DANGER_GRACE_MS = 1000;
/** 한 번 떨어뜨린 뒤 다음 과일을 떨어뜨릴 수 있을 때까지 */
export const DROP_COOLDOWN_MS = 450;

/** 물리 (px, 초) */
export const GRAVITY = 1500;
export const DROP_SPEED = 120;
/** 튕김 정도. 과일은 거의 안 튕기고 데굴데굴 구른다 */
export const RESTITUTION = 0.15;
/** 과일끼리 맞닿아 미끄러질 때 줄이는 비율 */
export const FRICTION = 0.08;
/** 초당 속도 감쇠 — 쌓인 과일이 계속 떨리지 않게 */
export const DAMPING = 0.8;
/** 한 번에 계산하는 시간 조각(ms). 빠르게 떨어져도 작은 과일을 뚫고 지나가지 않게 짧게 */
export const SUBSTEP_MS = 4;
export const SOLVER_ITERATIONS = 6;
/** 탭이 백그라운드였다가 돌아왔을 때 한 번에 몰아서 계산하지 않도록 프레임 간격 상한 */
export const MAX_FRAME_MS = 50;
/** 같은 과일끼리 이만큼 붙으면 합친다 (충돌 계산이 딱 붙게 떼어 놓기 때문에 약간 여유) */
export const MERGE_SLOP = 1.5;
/** 합쳐진 과일 반지름이 목표 크기로 커지는 속도(초당 비율) */
export const GROW_RATE = 14;
/** 떨어뜨릴 수 있는 과일: 가장 작은 것부터 이 개수 중 무작위 */
export const DROPPABLE_LEVELS = 5;
/** 수박 두 개가 합쳐져 사라질 때 점수 */
export const WATERMELON_BONUS = 100;
/** 방향키로 조준을 옮기는 속도(px/s) */
export const AIM_KEY_SPEED = 360;

export interface FruitKind {
  name: string;
  /** 그림 파일 이름 (FRUIT_IMAGE_BASE/<slug>.webp, 우는 얼굴은 <slug>-cry.webp) */
  slug: string;
  radius: number;
  /** 합쳐서 이 과일이 생기면 얻는 점수 */
  score: number;
  /** 그림을 아직 못 받았을 때 캔버스로 그리는 색 (과일 그림 자체라 테마 토큰이 아니다) */
  color: string;
  /** 줄무늬(수박·멜론) 색. 없으면 줄무늬 없음 */
  stripe?: string;
}

export const FRUITS: readonly FruitKind[] = [
  { name: "체리", slug: "cherry", radius: 14, score: 1, color: "#e11d48" },
  { name: "딸기", slug: "strawberry", radius: 19, score: 3, color: "#f43f5e" },
  { name: "포도", slug: "grape", radius: 26, score: 6, color: "#8b5cf6" },
  { name: "한라봉", slug: "hallabong", radius: 32, score: 10, color: "#fb923c" },
  { name: "감", slug: "persimmon", radius: 39, score: 15, color: "#ea580c" },
  { name: "사과", slug: "apple", radius: 47, score: 21, color: "#dc2626" },
  { name: "배", slug: "pear", radius: 55, score: 28, color: "#facc15" },
  { name: "복숭아", slug: "peach", radius: 63, score: 36, color: "#fda4af" },
  { name: "파인애플", slug: "pineapple", radius: 73, score: 45, color: "#eab308" },
  { name: "멜론", slug: "melon", radius: 85, score: 55, color: "#a3e635", stripe: "#65a30d" },
  { name: "수박", slug: "watermelon", radius: 100, score: 66, color: "#16a34a", stripe: "#14532d" },
];

/** 펠트 과일 그림 폴더. 그림이 없으면 drawFruit이 원·줄무늬·얼굴로 대신 그린다 */
export const FRUIT_IMAGE_BASE = "/assets/images/games/watermelon-game/fruits";
/** 과일 그림은 꼭지·잎이 공 밖으로 조금 나와 있어, 반지름보다 이 배율만큼 크게 그린다 */
export const FRUIT_IMAGE_SCALE = 1.16;
/** 합쳐져 사라지는 두 과일이 눈물을 뿌리며 좌우로 튀어 오르다 사라지는 시간과 튀는 속도(px/s) */
export const CRY_MS = 320;
export const CRY_SPEED = 130;

export const WATERMELON_LEVEL = FRUITS.length - 1;

/** 톡: 과일 떨어뜨림 */
export const DROP_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", from: 520, to: 260, ms: 90, level: 0.1 },
];

/** 뽁: 과일 합체. 큰 과일일수록 음이 낮아진다 (MERGE_PITCH_STEP) */
export const MERGE_SOUND: readonly SoundLayer[] = [
  { kind: "tone", wave: "sine", from: 700, to: 1100, ms: 110, level: 0.13 },
  { kind: "noise", filter: "bandpass", q: 2, from: 1800, to: 2600, ms: 60, level: 0.08 },
];
/** 과일 한 단계마다 합체음 높이에 곱하는 비율 */
export const MERGE_PITCH_STEP = 0.93;

/** 경고선이 깜빡이는 동안 삐삐를 반복하는 간격 */
export const WARNING_SOUND_MS = 700;
