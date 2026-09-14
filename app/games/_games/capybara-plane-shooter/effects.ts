import { EFFECTS } from "./constants";

/** 연출 색은 캔버스에서 globals.css 토큰 값을 읽어 칠한다 (컴포넌트의 readPalette) */
export type EffectColor = "text" | "success" | "warning" | "danger";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  size: number;
  color: EffectColor;
}

/** 격추 점수·먹은 간식 이름처럼 잠깐 떠올랐다 사라지는 글자 */
export interface Popup {
  x: number;
  y: number;
  text: string;
  color: EffectColor;
  big: boolean;
  ageMs: number;
}

/**
 * 게임 규칙(logic.ts)과 상관없는 화면 연출 상태: 화면 흔들림·파편·점수 글자·피격 붉은 테두리·총구 불꽃·맞은 순간 잠깐 멈춤.
 * step처럼 매 프레임 새 객체를 만들지 않고 직접 고친다
 */
export interface Effects {
  shakeMs: number;
  shakeTotalMs: number;
  shakePower: number;
  hitStopMs: number;
  damageFlashMs: number;
  muzzleMs: number;
  /** 폭탄이 터진 자리에서 퍼져 나가는 고리 */
  ringMs: number;
  ringX: number;
  ringY: number;
  particles: Particle[];
  popups: Popup[];
}

export function createEffects(): Effects {
  return {
    shakeMs: 0,
    shakeTotalMs: 0,
    shakePower: 0,
    hitStopMs: 0,
    damageFlashMs: 0,
    muzzleMs: 0,
    ringMs: 0,
    ringX: 0,
    ringY: 0,
    particles: [],
    popups: [],
  };
}

/** 흔들림은 남은 시간에 비례해 잦아든다 */
function currentShakePower(effects: Effects) {
  return effects.shakeMs > 0 && effects.shakeTotalMs > 0 ? effects.shakePower * (effects.shakeMs / effects.shakeTotalMs) : 0;
}

/** 이미 더 세게 흔들리는 중이면 약한 흔들림이 덮어쓰지 않는다 (격추가 몰려도 피격 흔들림이 끊기지 않게) */
export function shake(effects: Effects, power: number, ms: number) {
  if (currentShakePower(effects) > power) return;
  effects.shakePower = power;
  effects.shakeMs = ms;
  effects.shakeTotalMs = ms;
}

/** 이번 프레임에 세상을 옮겨 그릴 거리(게임 좌표 px). 흔들리지 않으면 0 */
export function shakeOffset(effects: Effects, random: () => number = Math.random) {
  const power = currentShakePower(effects);
  if (power === 0) return { x: 0, y: 0 };
  return { x: (random() * 2 - 1) * power, y: (random() * 2 - 1) * power };
}

/** 한 점에서 사방으로 튀는 파편. 살짝 위로 튀었다가 떨어진다. 한도를 넘으면 더 만들지 않는다 */
export function burst(
  effects: Effects,
  x: number,
  y: number,
  count: number,
  colors: readonly EffectColor[],
  speed: number,
  random: () => number = Math.random,
) {
  for (let i = 0; i < count && effects.particles.length < EFFECTS.maxParticles; i += 1) {
    const angle = random() * Math.PI * 2;
    const velocity = speed * (0.4 + random() * 0.6);
    effects.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - speed * 0.3,
      ageMs: 0,
      size: 2 + random() * 3,
      color: colors[i % colors.length],
    });
  }
}

export function popup(effects: Effects, x: number, y: number, text: string, color: EffectColor, big = false) {
  effects.popups.push({ x, y, text, color, big, ageMs: 0 });
}

/** 연출 시간을 흘린다. 게임이 멈춘(맞은 순간 잠깐 멈춤·격추당한 뒤) 동안에도 부른다 */
export function updateEffects(effects: Effects, dt: number) {
  const seconds = dt / 1000;
  effects.shakeMs = Math.max(0, effects.shakeMs - dt);
  effects.hitStopMs = Math.max(0, effects.hitStopMs - dt);
  effects.damageFlashMs = Math.max(0, effects.damageFlashMs - dt);
  effects.muzzleMs = Math.max(0, effects.muzzleMs - dt);
  effects.ringMs = Math.max(0, effects.ringMs - dt);

  for (const particle of effects.particles) {
    particle.ageMs += dt;
    particle.vy += EFFECTS.particleGravity * seconds;
    particle.x += particle.vx * seconds;
    particle.y += particle.vy * seconds;
  }
  effects.particles = effects.particles.filter((particle) => particle.ageMs < EFFECTS.particleLifeMs);

  for (const item of effects.popups) item.ageMs += dt;
  effects.popups = effects.popups.filter((item) => item.ageMs < EFFECTS.popupMs);
}

/** 파편과 떠오르는 글자. rise가 false(움직임 줄이기)면 글자는 제자리에서 흐려지기만 한다 */
export function drawEffects(
  ctx: CanvasRenderingContext2D,
  effects: Effects,
  palette: Record<EffectColor | "outline", string>,
  font: string,
  rise: boolean,
) {
  if (effects.ringMs > 0) {
    // 폭탄 고리: 터진 자리에서 크게 퍼지며 흐려진다
    const t = 1 - effects.ringMs / EFFECTS.ringMs;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = palette.warning;
    ctx.lineWidth = 8 * (1 - t) + 2;
    ctx.beginPath();
    ctx.arc(effects.ringX, effects.ringY, EFFECTS.ringRadius * t, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const particle of effects.particles) {
    ctx.globalAlpha = 1 - particle.ageMs / EFFECTS.particleLifeMs;
    ctx.fillStyle = palette[particle.color];
    ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const item of effects.popups) {
    const t = item.ageMs / EFFECTS.popupMs;
    // 대부분은 또렷하게 두고 끝에서만 흐려진다
    ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    ctx.font = `${item.big ? "900 28px" : "800 15px"} ${font}`;
    const y = item.y - (rise ? EFFECTS.popupRise * t : 0);
    // 밝은 배경·폭발 위에서도 읽히게 어두운 테두리를 먼저 그린다
    ctx.lineWidth = item.big ? 5 : 3;
    ctx.strokeStyle = palette.outline;
    ctx.strokeText(item.text, item.x, y);
    ctx.fillStyle = palette[item.color];
    ctx.fillText(item.text, item.x, y);
  }
  ctx.globalAlpha = 1;
}

/** 맞은 순간 화면 가장자리만 붉게 물들인다 (화면 전체 번쩍임은 눈이 아프고 광과민 우려가 있다) */
export function drawDamageFlash(
  ctx: CanvasRenderingContext2D,
  effects: Effects,
  width: number,
  height: number,
  color: string,
) {
  if (effects.damageFlashMs <= 0) return;
  const gradient = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.75);
  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(1, color);
  ctx.globalAlpha = (effects.damageFlashMs / EFFECTS.damageFlashMs) * 0.55;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
}
