// 굽는 프레임 목록: 이름(= 로비 스프라이트 이름) → 방향(yaw)·자세.
// 새 동작은 여기에 한 줄 넣고 bake.mjs를 돌리면 몸과 모든 옷이 같이 구워진다
export const VIEW = {
  /** 약간 위에서 내려다본 각도(°) */
  elevation: 14,
  /** 그림 한 변이 담는 월드 높이 (서 있는 키 ≈ 1) */
  height: 1.12,
  /** 발바닥 줄: 그림 위에서부터 비율 (로비 STAND_FOOT) */
  foot: 1000 / 1024,
};

const YAW = { down: 0, "down-right": 45, right: 90, "up-right": 135, up: 180, "up-left": -135, left: -90, "down-left": -45 };
const FOUR = ["down", "right", "up", "left"];

export const FRAMES = {};
const add = (name, yaw, pose = {}) => (FRAMES[name] = { yaw, pose });

// 걷기: 한 발 내딛고(walk1) 반대 발(walk2). 팔은 반대로 흔든다
const step = (s) => ({
  lift: 0.012,
  hips: [0, 0, s * 3],
  legL: [s * -26, 0, 0],
  legR: [s * 26, 0, 0],
  armL: [-50 + s * 24, 0, -14],
  armR: [-50 - s * 24, 0, 14],
  head: [0, 0, s * -2],
});
for (const [dir, yaw] of Object.entries(YAW)) {
  add(`stand-${dir}`, yaw);
  add(`walk1-${dir}`, yaw, step(1));
  add(`walk2-${dir}`, yaw, step(-1));
}

// 앉기: 엉덩이를 붙이고 두 발을 앞으로 뻗는다
const SIT = { sit: true, legL: [-82, 0, 8], legR: [-82, 0, -8], armL: [-30, 0, 16], armR: [-30, 0, -16], hips: [-6, 0, 0], chest: [4, 0, 0] };
for (const dir of FOUR) add(`idle-${dir}`, YAW[dir], SIT);
add("sleep-1", 0, { ...SIT, chest: [10, 0, 0], head: [14, 0, 6], face: "sleep" });
add("sleep-2", 0, { ...SIT, chest: [12, 0, 0], head: [16, 0, 8], face: "sleep" });

// 때리기: 앞발 하나를 곧게 앞으로
for (const dir of FOUR)
  add(`punch-${dir}`, YAW[dir], { armR: [-88, 0, -4], armL: [-50, 0, 18], chest: [4, -18, 0], hips: [0, -10, 0], legL: [-12, 0, 0], legR: [10, 0, 0] });

// 어지러움
add("stun", 0, { face: "dizzy", head: [0, 0, 8], armL: [-20, 0, 35], armR: [-20, 0, -35] });

// 먹기: 두 앞발로 음식을 입에 대고 오물오물
add("eating-1", 0, { face: "open", armL: [-110, 0, 30], armR: [-110, 0, -30], head: [-6, 0, 0] });
add("eating-2", 0, { face: "chew", armL: [-104, 0, 28], armR: [-104, 0, -28], head: [4, 0, 0] });

// 사과 따기: 웅크림(1) → 앞발 번쩍 뻗어 뜀(2) → 헛손질(3)
for (const dir of ["down", "up"]) {
  add(`pick-1-${dir}`, YAW[dir], { lift: -0.03, hips: [8, 0, 0], legL: [-30, 0, 0], legR: [-30, 0, 0], armL: [-30, 0, 20], armR: [-30, 0, -20], head: [-8, 0, 0] });
  add(`pick-2-${dir}`, YAW[dir], { lift: 0.04, armL: [-170, 0, 8], armR: [-170, 0, -8], legL: [14, 0, 0], legR: [14, 0, 0], head: [-18, 0, 0], face: "open" });
  add(`pick-3-${dir}`, YAW[dir], { armL: [-150, 0, 30], armR: [-120, 0, -20], head: [-10, 0, 10] });
}

// 엉덩이 긁기 (뒷모습): 앞발을 엉덩이에(1) → 위로(2) → 아래로(3)
add("scratch-1", 180, { armR: [30, 0, -30], armL: [-40, 0, 12], head: [0, 0, 0] });
add("scratch-2", 180, { armR: [44, 0, -36], armL: [-40, 0, 12], hips: [0, 0, 4], head: [0, 0, -6] });
add("scratch-3", 180, { armR: [18, 0, -26], armL: [-40, 0, 12], hips: [0, 0, -4], head: [0, 0, 6] });

// 하품(입 벌림 → 기지개 → 개운) · 졸기(꾸벅 → 더 깊이)
for (const dir of FOUR) {
  add(`yawn-1-${dir}`, YAW[dir], { face: "open", head: [-10, 0, 0], armL: [-60, 0, 20], armR: [-60, 0, -20] });
  add(`yawn-2-${dir}`, YAW[dir], { face: "yawn", head: [-16, 0, 0], chest: [-6, 0, 0], armL: [-175, 0, 22], armR: [-175, 0, -22], lift: 0.01 });
  add(`yawn-3-${dir}`, YAW[dir], { face: "sleep", head: [-4, 0, 0] });
  add(`doze-1-${dir}`, YAW[dir], { face: "doze", head: [14, 0, 0], chest: [6, 0, 0] });
  add(`doze-2-${dir}`, YAW[dir], { face: "doze", head: [24, 0, 6], chest: [10, 0, 0], armL: [-30, 0, 10], armR: [-30, 0, -10] });
}
