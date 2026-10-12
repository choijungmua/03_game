// 카피바라 런 그리기. 논리 좌표(640×300 기준)로 그리고, 캔버스는 기기 해상도(devicePixelRatio)로 키워 선명하게 한다.
// 화면이 가로로 넓으면 더 멀리 보이고(viewW), 세로로 남는 공간은 하늘을 위로 늘려 채운다(top < 0)

import {
  BAR_Y,
  type Coin,
  COIN_R,
  GROUND,
  type Hazard,
  HEIGHT,
  MAX_HEARTS,
  MAX_SPEED,
  PLAYER_X,
  type RunState,
  SLIDE_H,
  START_SPEED,
  WIDTH,
} from "./logic";
import { SPRITE_SIZES, type SpriteName } from "./sprites";

export const IMAGE_BASE = "/assets/images/games/capybara-run";
export type Images = Partial<Record<SpriteName | "bg-far", HTMLImageElement>>;

/** 카피바라 그림 배율 (시트 px → 논리 px) */
const CAPY = 0.21;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

export interface Popup {
  text: string;
  x: number;
  y: number;
  /** 장애물·보너스는 크게, 초·코인은 작게 */
  big: boolean;
  age: number;
}

export interface Effects {
  particles: Particle[];
  popups: Popup[];
  /** 보너스 배너 (왕관 + 점수) */
  banner: { points: number; age: number } | null;
  shake: number;
  /** 다쳤을 때 화면 가장자리 붉은빛 (1→0) */
  flash: number;
}

export interface View {
  /** 논리 px → CSS px */
  scale: number;
  dpr: number;
  /** 보이는 논리 가로 */
  viewW: number;
  /** 보이는 맨 위 논리 y (0 이하) */
  top: number;
}

export const POPUP_FRAMES = 55;
export const BANNER_FRAMES = 90;

const ready = (image?: HTMLImageElement): image is HTMLImageElement => Boolean(image?.complete && image.naturalWidth > 0);

function sprite(context: CanvasRenderingContext2D, images: Images, name: SpriteName, x: number, y: number, w: number, h: number) {
  const image = images[name];
  if (ready(image)) context.drawImage(image, x, y, w, h);
}

/** 0~1 고정 난수 (위치마다 같은 값) */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

function pitAt(state: RunState, worldX: number) {
  return state.hazards.some((hazard) => hazard.kind === "pit" && worldX > hazard.x && worldX < hazard.x + hazard.w);
}

// --- 배경 ---

function drawSky(context: CanvasRenderingContext2D, state: RunState, view: View, images: Images) {
  const sky = context.createLinearGradient(0, view.top, 0, GROUND);
  sky.addColorStop(0, "#4f9fe0");
  sky.addColorStop(0.7, "#a9dcf7");
  sky.addColorStop(1, "#e3f6ff");
  context.fillStyle = sky;
  context.fillRect(0, view.top, view.viewW, GROUND - view.top);

  const far = images["bg-far"];
  if (ready(far)) {
    // 먼 풍경은 아주 느리게 흐른다 (가로로 이어 붙임)
    const height = GROUND - view.top + 30;
    const width = height * (far.naturalWidth / far.naturalHeight);
    // 한 장씩 좌우를 뒤집어 이어 붙여 이음매가 안 보이게 한다
    const travel = state.distance * 0.06;
    const first = Math.floor(travel / width);
    for (let index = first; index * width - travel < view.viewW; index += 1) {
      const x = index * width - travel;
      context.save();
      if (index % 2 !== 0) {
        context.translate(x + width, 0);
        context.scale(-1, 1);
        context.drawImage(far, -0.5, view.top, width + 1, height);
      } else context.drawImage(far, x - 0.5, view.top, width + 1, height);
      context.restore();
    }
  }
}

/** 가운데 숲: 펠트 같은 둥근 나무들, 중간 속도로 흐른다 */
function drawForest(context: CanvasRenderingContext2D, state: RunState, view: View) {
  // 땅 바로 뒤 작은 덤불 한 줄 (먼 언덕은 배경 그림이 맡는다)
  const layers = [{ speed: 0.55, gap: 64, base: GROUND + 4, size: 11, dark: "#3f7a3e", light: "#8cc86a" }];
  for (const layer of layers) {
    const shift = state.distance * layer.speed;
    const first = Math.floor(shift / layer.gap) - 1;
    for (let index = first; index < first + view.viewW / layer.gap + 3; index += 1) {
      const x = index * layer.gap - shift + hash(index) * 30;
      const size = layer.size * (0.7 + hash(index + 3) * 0.6);
      const trunk = size * 0.2;
      const leaf = context.createRadialGradient(x - size * 0.35, layer.base - trunk - size * 0.5, size * 0.1, x, layer.base - trunk, size * 1.2);
      leaf.addColorStop(0, layer.light);
      leaf.addColorStop(1, layer.dark);
      context.fillStyle = leaf;
      for (const [dx, dy, r] of [
        [0, -size * 0.3, 1],
        [-size * 0.55, 0.1 * size, 0.7],
        [size * 0.55, 0.15 * size, 0.72],
      ]) {
        context.beginPath();
        context.arc(x + dx, layer.base - trunk + dy, size * r, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
}

/** 땅: 낭떠러지만 비우고 흙·풀을 깐다. 낭떠러지 양쪽엔 흙 기둥 그림 */
function drawGround(context: CanvasRenderingContext2D, state: RunState, view: View, images: Images) {
  const bottom = HEIGHT + 10;
  const dirt = context.createLinearGradient(0, GROUND, 0, bottom);
  dirt.addColorStop(0, "#b8834c");
  dirt.addColorStop(1, "#6c4628");
  // 보이는 구간을 낭떠러지 기준으로 쪼갠다
  const pits = state.hazards
    .filter((hazard) => hazard.kind === "pit")
    .map((hazard) => [hazard.x - state.distance, hazard.x + hazard.w - state.distance])
    .filter(([start, end]) => end > -40 && start < view.viewW + 40)
    .sort((a, b) => a[0] - b[0]);
  const segments: [number, number][] = [];
  let cursor = -20;
  for (const [start, end] of pits) {
    if (start > cursor) segments.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  segments.push([cursor, view.viewW + 20]);

  for (const [start, end] of segments) {
    context.fillStyle = dirt;
    context.fillRect(start, GROUND, end - start, bottom - GROUND);
    // 흙 속 조약돌 (땅과 같은 속도로 흘러 빠르기가 느껴진다)
    context.fillStyle = "rgba(90,58,30,0.55)";
    const first = Math.floor((start + state.distance) / 37);
    for (let index = first; index < (end + state.distance) / 37; index += 1) {
      const x = index * 37 - state.distance + hash(index) * 20;
      if (x < start + 4 || x > end - 4) continue;
      context.beginPath();
      context.ellipse(x, GROUND + 14 + hash(index + 1) * 20, 4 + hash(index + 2) * 3, 2.5, 0, 0, Math.PI * 2);
      context.fill();
    }
    // 몽글몽글한 풀 윗면
    const grass = context.createLinearGradient(0, GROUND - 6, 0, GROUND + 8);
    grass.addColorStop(0, "#9fd36a");
    grass.addColorStop(1, "#5e9a3c");
    context.fillStyle = grass;
    context.fillRect(start, GROUND, end - start, 7);
    for (let x = start - ((state.distance + start) % 12); x < end; x += 12) {
      if (x < start - 2) continue;
      context.beginPath();
      context.arc(x + 6, GROUND + 1, 6.5, Math.PI, 0);
      context.fill();
    }
  }
  // 낭떠러지: 어두운 구덩이 + 양쪽 흙 기둥
  for (const [start, end] of pits) {
    const hole = context.createLinearGradient(0, GROUND, 0, bottom);
    hole.addColorStop(0, "rgba(40,24,14,0.85)");
    hole.addColorStop(1, "rgba(10,6,4,1)");
    context.fillStyle = hole;
    context.fillRect(start, GROUND + 12, end - start, bottom - GROUND);
    const [cw, ch] = SPRITE_SIZES.cliff;
    const width = 22;
    const height = (width * ch) / cw;
    sprite(context, images, "cliff", start - width + 6, GROUND - 6, width, height);
    context.save();
    context.translate(end + width - 6, GROUND - 6);
    context.scale(-1, 1);
    sprite(context, images, "cliff", 0, 0, width, height);
    context.restore();
  }
}

// --- 장애물 ---

function drawFire(context: CanvasRenderingContext2D, x: number, w: number, frame: number) {
  context.save();
  const glow = context.createRadialGradient(x + w / 2, GROUND, 4, x + w / 2, GROUND - 10, w * 0.9);
  glow.addColorStop(0, "rgba(255,150,40,0.45)");
  glow.addColorStop(1, "rgba(255,120,0,0)");
  context.fillStyle = glow;
  context.fillRect(x - w * 0.4, GROUND - w, w * 1.8, w + 10);
  // 불꽃 혀: 바깥 주황 → 안쪽 노랑, 기둥마다 다른 리듬으로 날름거린다
  for (let flameX = x + 2; flameX < x + w - 4; flameX += 9) {
    const t = frame * 0.18 + flameX * 0.37;
    const height = 36 + Math.sin(t) * 8 + Math.sin(t * 2.3) * 4;
    const sway = Math.sin(t * 1.4) * 2.5;
    for (const [inner, outer, scale] of [
      ["rgba(214,48,20,0.95)", "rgba(240,90,20,0.15)", 1],
      ["rgba(255,140,30,0.95)", "rgba(255,170,40,0.2)", 0.68],
      ["rgba(255,236,150,1)", "rgba(255,210,90,0.3)", 0.36],
    ] as const) {
      const top = GROUND - height * scale;
      const gradient = context.createLinearGradient(0, GROUND, 0, top);
      gradient.addColorStop(0, inner);
      gradient.addColorStop(1, outer);
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(flameX - 8 * scale - 2, GROUND + 2);
      context.bezierCurveTo(flameX - 9 * scale, GROUND - height * scale * 0.45, flameX - 2 + sway, GROUND - height * scale * 0.7, flameX + sway, top);
      context.bezierCurveTo(flameX + 3 + sway, GROUND - height * scale * 0.65, flameX + 10 * scale, GROUND - height * scale * 0.4, flameX + 8 * scale + 3, GROUND + 2);
      context.fill();
    }
  }
  // 위로 날리는 불씨
  for (let index = 0; index < Math.ceil(w / 14); index += 1) {
    const rise = (frame * 1.3 + index * 23) % 70;
    const ex = x + hash(index) * w + Math.sin((frame + index * 10) * 0.12) * 4;
    context.fillStyle = `rgba(255,${180 + ((index * 7) % 60)},80,${1 - rise / 70})`;
    context.beginPath();
    context.arc(ex, GROUND - 20 - rise, 1.6, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawBar(context: CanvasRenderingContext2D, hazard: Hazard, state: RunState, view: View) {
  const x = hazard.x - state.distance;
  const { w } = hazard;
  // 양 끝을 위에서 굵은 밧줄로 매단 나무 철봉
  context.strokeStyle = "#8a6a44";
  context.lineWidth = 2.5;
  for (const ropeX of [x + 10, x + w - 10]) {
    context.beginPath();
    context.moveTo(ropeX, view.top);
    context.lineTo(ropeX, BAR_Y);
    context.stroke();
  }
  const wood = context.createLinearGradient(0, BAR_Y - 5, 0, BAR_Y + 5);
  wood.addColorStop(0, "#d9a066");
  wood.addColorStop(0.5, "#a8703c");
  wood.addColorStop(1, "#6e4626");
  context.fillStyle = wood;
  context.beginPath();
  context.roundRect(x, BAR_Y - 5, w, 10, 5);
  context.fill();
  // 밧줄 감김 (손잡이 느낌)
  context.fillStyle = "#e8d3a8";
  for (let wrap = x + 30; wrap < x + w - 20; wrap += 64) context.fillRect(wrap, BAR_Y - 5, 5, 10);

  // 아직 안 잡았을 때: 철봉이 숨쉬듯 빛나고 "2단 점프로 잡기!" 안내
  const ahead = x - PLAYER_X;
  if (state.player.mode !== "hang" && ahead > -40 && ahead < 420) {
    const pulse = 0.35 + Math.sin(state.frame * 0.2) * 0.25;
    context.strokeStyle = `rgba(255,236,150,${pulse})`;
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(x - 2, BAR_Y - 7, Math.min(w, 260) + 4, 14, 7);
    context.stroke();
    context.font = "bold 11px Pretendard, sans-serif";
    context.textAlign = "left";
    context.fillStyle = `rgba(255,255,255,${0.6 + pulse})`;
    context.strokeStyle = "rgba(60,40,20,0.5)";
    context.lineWidth = 3;
    context.strokeText("⬆⬆ 2단 점프로 잡기!", x + 6, BAR_Y - 14);
    context.fillText("⬆⬆ 2단 점프로 잡기!", x + 6, BAR_Y - 14);
  }
}

function drawHazard(context: CanvasRenderingContext2D, hazard: Hazard, state: RunState, view: View, images: Images) {
  const x = hazard.x - state.distance;
  const { w } = hazard;
  if (x > view.viewW + 20 || x + w < -40) return;
  switch (hazard.kind) {
    case "fire":
      drawFire(context, x, w, state.frame);
      break;
    case "thorn": {
      const [tw, th] = SPRITE_SIZES.thorn;
      const height = 34;
      const width = (height * tw) / th;
      for (let tx = x - 6; tx < x + w - width * 0.4; tx += width * 0.62) sprite(context, images, "thorn", tx, GROUND - height + 6, width, height);
      break;
    }
    case "log": {
      const [lw, lh] = SPRITE_SIZES.log;
      const width = w + 10;
      sprite(context, images, "log", x - 5, GROUND - (width * lh) / lw + 3, width, (width * lh) / lw);
      break;
    }
    case "branch": {
      const [bw, bh] = SPRITE_SIZES.branch;
      const height = 92;
      const width = (height * bw) / bh;
      const bottom = GROUND - SLIDE_H - 3;
      context.fillStyle = "#6b4a2b";
      context.fillRect(x + w / 2 - 4, view.top, 8, bottom - height - view.top + 10);
      sprite(context, images, "branch", x + w / 2 - width / 2, bottom - height, width, height);
      break;
    }
    case "step": {
      // 흙 기둥 위에 풀·돌 덮개. 덮개는 돌 블록 그림을 겹쳐 이어 틈이 안 보이게 한다
      const earth = context.createLinearGradient(0, hazard.top, 0, GROUND + 40);
      earth.addColorStop(0, "#a8774a");
      earth.addColorStop(1, "#6a4528");
      context.fillStyle = earth;
      context.beginPath();
      context.roundRect(x + 2, hazard.top + 14, w - 4, GROUND + 40 - hazard.top, 6);
      context.fill();
      context.fillStyle = "rgba(80,50,26,0.45)";
      for (let index = 0; index < (w * (GROUND - hazard.top)) / 900; index += 1) {
        const px = x + 8 + hash(hazard.id * 31 + index) * (w - 16);
        const py = hazard.top + 30 + hash(hazard.id * 17 + index) * (GROUND - hazard.top - 30);
        context.beginPath();
        context.ellipse(px, py, 4, 2.5, 0, 0, Math.PI * 2);
        context.fill();
      }
      const [sw, sh] = SPRITE_SIZES.step;
      const capH = 30;
      const capW = (capH * sw) / sh;
      const count = Math.max(1, Math.round((w + 6) / (capW * 0.85)));
      const stepW = (w + 6 - capW) / Math.max(1, count - 1);
      for (let index = 0; index < count; index += 1) sprite(context, images, "step", x - 3 + index * stepW, hazard.top - 6, capW, capH);
      break;
    }
    case "bar":
      drawBar(context, hazard, state, view);
      break;
    case "pit":
      break;
  }
}

function drawCoin(context: CanvasRenderingContext2D, coin: Coin, state: RunState, images: Images) {
  if (coin.taken) return;
  const x = coin.x - state.distance;
  const y = coin.y + Math.sin(state.frame * 0.1 + coin.id) * 1.5;
  // 빙글빙글: 가로 폭이 cos로 줄었다 늘었다
  const turn = Math.cos(state.frame * 0.11 + coin.id * 0.6);
  const size = COIN_R * 2.3;
  context.save();
  const glow = context.createRadialGradient(x, y, 1, x, y, size);
  glow.addColorStop(0, "rgba(255,225,120,0.35)");
  glow.addColorStop(1, "rgba(255,225,120,0)");
  context.fillStyle = glow;
  context.fillRect(x - size, y - size, size * 2, size * 2);
  context.translate(x, y);
  context.scale(Math.max(0.12, Math.abs(turn)), 1);
  if (turn < 0) context.filter = "brightness(0.82)";
  sprite(context, images, "coin", -size / 2, -size / 2, size, size);
  context.restore();
}

// --- 카피바라 ---

function drawPlayer(context: CanvasRenderingContext2D, state: RunState, images: Images) {
  const { player } = state;
  context.save();
  // 다친 동안은 사라지지 않고 반투명하게 숨쉰다 (깜빡임으로 눈이 아프지 않게)
  if (state.hurt > 0) context.globalAlpha = 0.45 + Math.sin(state.frame * 0.5) * 0.2;

  const draw = (name: SpriteName, bottom: number, angle = 0, alpha = 1) => {
    const [sw, sh] = SPRITE_SIZES[name];
    const w = sw * CAPY;
    const h = sh * CAPY;
    context.save();
    context.globalAlpha *= alpha;
    context.translate(PLAYER_X, bottom - h / 2);
    context.rotate(angle);
    sprite(context, images, name, -w / 2, -h / 2, w, h);
    context.restore();
  };

  // 그림자 (땅 위에 있을 때만, 높이 뜰수록 작고 흐리게)
  if (!pitAt(state, state.distance + PLAYER_X) && player.mode !== "hang") {
    const lift = Math.max(0, GROUND - player.y);
    context.fillStyle = `rgba(40,30,10,${0.28 * Math.max(0.2, 1 - lift / 160)})`;
    context.beginPath();
    context.ellipse(PLAYER_X, GROUND + 2, 22 * Math.max(0.4, 1 - lift / 200), 4, 0, 0, Math.PI * 2);
    context.fill();
  }

  if (player.mode === "run") {
    // 달린 거리에 맞춰 다리를 움직인다 → 빨라질수록 발놀림도 빨라진다
    const phase = state.distance / 22;
    const frame = (["run-1", "run-2", "run-3", "run-4"] as const)[Math.floor(phase) % 4];
    const bob = -Math.abs(Math.sin(phase * (Math.PI / 2))) * 3;
    draw(frame, player.y + 2 + bob, -0.06);
  } else if (player.mode === "slide") {
    draw("slide", player.y + 3);
  } else if (player.mode === "hang") {
    // 매달려 앞으로 흔들리며 이동
    const [, hh] = SPRITE_SIZES.hang;
    const swing = Math.sin(state.frame * 0.16) * 0.12;
    context.save();
    context.translate(PLAYER_X, BAR_Y);
    context.rotate(swing);
    context.translate(-PLAYER_X, -BAR_Y);
    draw("hang", BAR_Y - 6 + hh * CAPY);
    context.restore();
  } else if (player.spin >= 0 && player.spin < 26) {
    // 덤블링: 한 바퀴를 빠르게 돌다 감속 (ease-out) + 잔상
    const turn = (t: number) => (1 - (1 - Math.min(1, t / 26)) ** 3) * Math.PI * 2;
    for (let ghost = 3; ghost >= 1; ghost -= 1) {
      if (player.spin - ghost * 2 < 0) continue;
      context.save();
      context.translate(-ghost * 6, ghost * 3);
      draw("tumble", player.y + 4, turn(player.spin - ghost * 2), 0.18);
      context.restore();
    }
    draw("tumble", player.y + 4, turn(player.spin));
  } else {
    // 올라갈 땐 쭉 편 점프, 내려올 땐 다리 모은 자세
    draw(player.vy < 0 ? "jump" : "run-2", player.y + 2, player.vy < 0 ? 0.08 : 0.12);
  }
  context.restore();
}

// --- 효과·화면 위 표시 ---

function drawSpeedLines(context: CanvasRenderingContext2D, state: RunState, view: View) {
  const strength = (state.speed - 11) / (MAX_SPEED - 11);
  if (strength <= 0) return;
  // 은은하게: 얇고 투명한 바람 줄 몇 개만
  context.lineCap = "round";
  for (let index = 0; index < 3 + strength * 6; index += 1) {
    const y = view.top + 20 + hash(index) * (GROUND - view.top - 40);
    const length = 30 + strength * 70;
    const x = view.viewW - ((state.frame * state.speed * 1.6 + index * 173) % (view.viewW + length * 2)) + length;
    const gradient = context.createLinearGradient(x, 0, x + length, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(1, `rgba(255,255,255,${0.12 + strength * 0.16})`);
    context.strokeStyle = gradient;
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y);
    context.stroke();
  }
}

function drawParticles(context: CanvasRenderingContext2D, effects: Effects) {
  for (const particle of effects.particles) {
    context.globalAlpha = Math.max(0, particle.life / particle.max);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function outlined(context: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, alpha = 1) {
  context.lineJoin = "round";
  context.lineWidth = 4;
  context.strokeStyle = `rgba(40,25,10,${0.45 * alpha})`;
  context.strokeText(text, x, y);
  context.fillStyle = fill;
  context.fillText(text, x, y);
}

function drawHud(context: CanvasRenderingContext2D, state: RunState, effects: Effects, view: View, images: Images) {
  const center = view.viewW / 2;
  const top = view.top;
  context.textAlign = "center";
  context.font = "800 26px Pretendard, sans-serif";
  outlined(context, state.score.toLocaleString(), center, top + 34, "#ffffff");

  // 하트 · 코인 · 속도 한 줄
  context.font = "700 12px Pretendard, sans-serif";
  const rowY = top + 54;
  for (let index = 0; index < MAX_HEARTS; index += 1) {
    context.globalAlpha = index < state.hearts ? 1 : 0.25;
    sprite(context, images, "heart", center - 88 + index * 17, rowY - 11, 15, 13);
  }
  context.globalAlpha = 1;
  sprite(context, images, "coin", center - 26, rowY - 11, 13, 13);
  context.textAlign = "left";
  outlined(context, `${state.coinCount}`, center - 10, rowY, "#ffe27a");
  outlined(context, `속도 ×${(state.speed / START_SPEED).toFixed(1)}`, center + 28, rowY, "#ffffff");
  context.textAlign = "center";

  // 점수 알림: 장애물 점수·초 점수는 점수판 밑에서, 코인 점수는 코인 자리에서 떠오른다
  let row = 0;
  for (const popup of effects.popups) {
    const alpha = 1 - popup.age / POPUP_FRAMES;
    const stacked = popup.y === -1 ? row++ * 19 : 0;
    const rise = popup.age * (popup.big ? 0.35 : 0.6);
    context.font = popup.big ? "800 16px Pretendard, sans-serif" : "700 11px Pretendard, sans-serif";
    const y = popup.y === -1 ? top + 78 + stacked : popup.y;
    outlined(context, popup.text, popup.x === -1 ? center : popup.x, y - rise, popup.big ? `rgba(255,214,70,${alpha})` : `rgba(255,255,255,${alpha})`, alpha);
  }

  if (effects.banner) {
    // 보너스: 왕관이 튀어나왔다 사라진다
    const t = effects.banner.age / BANNER_FRAMES;
    const pop = t < 0.15 ? t / 0.15 : 1;
    const alpha = t > 0.75 ? (1 - t) / 0.25 : 1;
    const scale = 0.6 + pop * 0.4 + Math.sin(Math.min(1, t * 4) * Math.PI) * 0.12;
    context.save();
    context.globalAlpha = alpha;
    context.translate(center, top + (GROUND - top) * 0.42);
    context.scale(scale, scale);
    sprite(context, images, "crown", -18, -40, 36, 29);
    context.font = "900 15px Pretendard, sans-serif";
    outlined(context, `코인 올클리어! +${effects.banner.points}`, 0, 8, "#ffe066");
    context.restore();
  }
}

export function draw(context: CanvasRenderingContext2D, view: View, state: RunState, effects: Effects, images: Images) {
  context.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, 0, -view.top * view.dpr * view.scale);
  context.imageSmoothingQuality = "high";
  context.save();
  if (effects.shake > 0) context.translate((hash(state.frame) - 0.5) * effects.shake, (hash(state.frame + 1) - 0.5) * effects.shake);
  drawSky(context, state, view, images);
  drawForest(context, state, view);
  drawGround(context, state, view, images);
  for (const hazard of state.hazards) if (hazard.kind !== "bar" && hazard.kind !== "branch") drawHazard(context, hazard, state, view, images);
  for (const coin of state.coins) drawCoin(context, coin, state, images);
  drawPlayer(context, state, images);
  // 위에 걸린 것(철봉·가지)은 카피바라 앞에 그려 손으로 잡는 느낌을 낸다
  for (const hazard of state.hazards) if (hazard.kind === "bar" || hazard.kind === "branch") drawHazard(context, hazard, state, view, images);
  drawParticles(context, effects);
  drawSpeedLines(context, state, view);
  context.restore();
  if (effects.flash > 0) {
    const vignette = context.createRadialGradient(view.viewW / 2, HEIGHT / 2, HEIGHT * 0.4, view.viewW / 2, HEIGHT / 2, view.viewW * 0.7);
    vignette.addColorStop(0, "rgba(255,60,40,0)");
    vignette.addColorStop(1, `rgba(255,60,40,${effects.flash * 0.3})`);
    context.fillStyle = vignette;
    context.fillRect(0, view.top, view.viewW, HEIGHT - view.top);
  }
  drawHud(context, state, effects, view, images);
}

/** 보이는 영역 계산: 세로를 꽉 채우되, 너무 좁은 화면(세로 휴대폰)은 가로 기준으로 맞추고 위쪽 하늘을 늘린다 */
export function viewFor(cssWidth: number, cssHeight: number, dpr: number): View {
  const scale = Math.min(cssHeight / HEIGHT, cssWidth / (WIDTH * 0.8));
  return { scale, dpr, viewW: cssWidth / scale, top: HEIGHT - cssHeight / scale };
}
