// 로비 카피바라 레벨. 경험치는 서버만 쌓는다 (로비에 있는 시간·때리기·낚시·미니게임 한 판). 클라이언트는 받은 레벨을 보여 주기만 한다
// 04_game_b src/lobby/level.ts와 같은 식이어야 한다 (바꾸면 두 곳을 같이 바꿀 것)

export const MAX_LEVEL = 30;
/** 이 레벨부터 대시를 쓸 수 있다 */
export const DASH_LEVEL = 5;
/** 레벨 n이 되려면 XP_PER_LEVEL × (n-1)² 경험치. 로비에 1초 있으면 1 → 5레벨 16분, 30레벨 약 14시간 */
const XP_PER_LEVEL = 60;
/** 30레벨 이동 속도 배율 (1레벨은 1배 = 지금 기본 속도) */
const MAX_SPEED = 1.6;

export const levelOf = (xp: number) => Math.min(MAX_LEVEL, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / XP_PER_LEVEL)));

/** 레벨에 따른 이동 속도 배율. 1레벨 1배에서 30레벨 MAX_SPEED배까지 고르게 오른다 */
export const speedOf = (level: number) => 1 + ((MAX_SPEED - 1) * (Math.min(MAX_LEVEL, Math.max(1, level)) - 1)) / (MAX_LEVEL - 1);

export const DASH_COOLDOWN_MS = 5000;
/** 대시로 미끄러지는 거리(px)와 시간 */
export const DASH_DISTANCE = 150;
export const DASH_MS = 180;
/** 대시 경로에서 이 거리 안에 몸이 닿으면 맞는다 */
export const DASH_HIT_RADIUS = 36;
