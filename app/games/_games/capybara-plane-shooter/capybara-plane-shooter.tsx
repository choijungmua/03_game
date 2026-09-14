"use client";

import { Bomb, ChevronDown, Heart, Shield, Zap } from "lucide-react";
import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { Progress } from "@/components/feedback/progress";
import { GameControls } from "@/components/games/game-controls";
import { ShareButton } from "@/components/games/share-button";
import { cn } from "@/lib";
import { GAME_SOUNDS, GAME_TITLES } from "@/lib/games/constants";
import { submitGameRecord } from "@/lib/games/game-events";
import { useInView } from "@/lib/games/use-in-view";
import { useLockPageScroll } from "@/lib/games/use-lock-page-scroll";
import { playGameSound, type SoundLayer } from "@/lib/lobby/settings";

import {
  EFFECTS,
  GAME_OVER_MS,
  PLANE_EXPLOSION_MS,
  PLANE_EXPLOSION_SIZE,
  PLANE_SHOOTER_SOUNDS,
  RESULT_TAP_GUARD_MS,
  SKILL_KEYS,
  SOUND_GAP_MS,
} from "./constants";
import {
  burst,
  createEffects,
  drawDamageFlash,
  drawEffects,
  type Effects,
  popup,
  shake,
  shakeOffset,
  updateEffects,
} from "./effects";
import { PlaneShooterLeaderboard } from "./leaderboard";
import {
  BARRIER_RADIUS,
  BOSS_CLEAR_SCORE,
  BOSS_PATTERN_LABELS,
  BOSS_REWARD_LEVELS,
  BOSS_STUN_LABEL,
  CHARGE_WINDUP_MS,
  createState,
  DASHER_WINDUP_MS,
  EXPLOSION_MS,
  type GameInput,
  type GameState,
  getBossHomeY,
  getBossPattern,
  getBossPhase,
  getPlaneY,
  getStageConfig,
  isBossGuarding,
  isBossStage,
  isLaserActive,
  isShieldUp,
  ITEMS,
  KILL_SCORE,
  BULLET_RADIUS,
  LASER_HALF_WIDTH,
  LASER_WINDUP_MS,
  MAX_FRAME_MS,
  MAX_HP,
  MAX_WEAPON_LEVEL,
  OVERDRIVE_LEVELS,
  SKILL_GAUGE_MAX,
  type SkillKind,
  SKILLS,
  STAGE_CLEAR_SCORE,
  step,
  type WeaponKind,
} from "./logic";
import { formatScore, getRank, insertRecord, saveRecords, usePlaneShooterRecords } from "./records";
import {
  BULLET_SPRITES,
  CAPYBARA_SPRITES,
  ENEMY_SPRITES,
  EXPLOSION_FRAMES,
  FLAME_FRAMES,
  getBackgroundSpriteKey,
  isSpriteReady,
  ITEM_SPRITES,
  loadSprites,
  PLANE_SPRITES,
  SHOT_SPRITES,
  type SpriteImages,
  SPRITES,
  TIER_SPRITES,
} from "./sprites";
import { getPlaneShooterTier, PLANE_SHOOTER_TIERS } from "./tiers";

export const COUNTDOWN_VALUES = [3, 2, 1] as const;
export const COUNTDOWN_STEP_MS = 800;

const TITLE = GAME_TITLES["capybara-plane-shooter"];
const LEFT_KEYS = new Set(["ArrowLeft", "a", "A"]);
const RIGHT_KEYS = new Set(["ArrowRight", "d", "D"]);
const SKILL_ICONS: Record<SkillKind, typeof Shield> = { barrier: Shield, overdrive: Zap, bomb: Bomb };

/**
 * 게임 세계 크기는 기기와 상관없이 고정이다. 화면에는 이 비율 그대로 확대·축소만 해서 맞추므로
 * 폰이든 PC든 보이는 범위·적 속도·탄 간격이 모두 같다
 */
const GAME_WIDTH = 450;
const GAME_HEIGHT = 800;

/** 게임 안에서 그리는 크기(px). 판정 반경에 맞춰 잡는다 */
const PLANE_SIZE = 46;
const FLAME_WIDTH = 14;
const FLAME_HEIGHT = 19;
const FLAME_FRAME_MS = 90;
const ENEMY_SIZE_RATIO = 2.5;
const SHOT_SIZE_RATIO = 2.6;
const ITEM_SIZE_RATIO = 2.4;
const BANNER_CAPYBARA_SIZE = 96;
/** 아래 습지 풍경이 흘러가는 속도 (px/초) */
const BACKGROUND_SCROLL_SPEED = 40;

type Phase = "idle" | "countdown" | "playing" | "result";

interface RoundResult {
  score: number;
  stage: number;
  recordId: string;
  rank: number;
}

interface Hud {
  hp: number;
  stage: number;
  score: number;
  weapon: WeaponKind;
  weaponLevel: number;
  skillGauge: number;
  barrier: boolean;
  overdrive: boolean;
  /** 보스 남은 체력(%, 2 단위). 보스가 없으면 null */
  bossHp: number | null;
  /** 보스가 지금 쓰는 패턴 이름 (보스가 없으면 null) */
  bossPattern: string | null;
  killsLeft: number;
}

interface Palette {
  text: string;
  danger: string;
  success: string;
  warning: string;
  /** 떠오르는 글자 테두리 */
  outline: string;
  font: string;
}

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

/** 캔버스 색은 하드코딩하지 않고 토큰 값을 읽는다 (플레이 화면은 .dark 범위라 어두운 습지 배경 위에서 밝게 보인다) */
function readPalette(canvas: HTMLCanvasElement): Palette {
  const style = getComputedStyle(canvas);
  return {
    text: style.getPropertyValue("--foreground").trim(),
    danger: style.getPropertyValue("--destructive").trim(),
    success: style.getPropertyValue("--success").trim(),
    warning: style.getPropertyValue("--warning").trim(),
    outline: style.getPropertyValue("--background").trim(),
    font: style.fontFamily,
  };
}

function readHud(state: GameState): Hud {
  const boss = state.enemies.find((enemy) => enemy.kind === "boss");
  return {
    hp: state.hp,
    stage: state.stage,
    score: state.score,
    weapon: state.weapon,
    weaponLevel: state.weaponLevel,
    // 게이지는 정수로만 바꿔 보스 피해로 조금씩 찰 때마다 다시 그리지 않게 한다
    skillGauge: Math.floor(state.skillGauge),
    barrier: state.barrierMs > 0,
    overdrive: state.overdriveMs > 0,
    // 체력바는 2% 단위로만 바꿔 맞을 때마다 HUD 전체를 다시 그리지 않게 한다
    bossHp: boss ? Math.max(0, Math.ceil((boss.hp / boss.maxHp) * 50) * 2) : null,
    bossPattern: boss ? (state.bossStunMs > 0 ? BOSS_STUN_LABEL : BOSS_PATTERN_LABELS[getBossPattern(state)]) : null,
    killsLeft: Math.max(0, getStageConfig(state.stage).killGoal - state.stageKills),
  };
}

/** step 직전 상태 중 효과음·연출 판단에 필요한 것만 떠 둔다 (배열은 새로 생긴·사라진 것을 가리려고 참조를 복사) */
type FrameSnapshot = Pick<
  GameState,
  | "hp"
  | "stage"
  | "bank"
  | "fireInMs"
  | "weaponLevel"
  | "shieldBlocks"
  | "splits"
  | "skillGauge"
  | "barrierMs"
  | "overdriveMs"
  | "bombMs"
  | "bossPatternIndex"
  | "bossPatternMs"
  | "bossStunMs"
  | "items"
> & {
  /** 보스가 부하를 불렀는지 보려고 적 수를 센다 */
  enemyCount: number;
  hasBoss: boolean;
  /** 보스가 격파되면 이번 프레임에 사라지므로 터질 자리를 미리 떠 둔다 */
  bossX: number;
  bossY: number;
  /** 보스가 없으면 0 */
  bossPhase: number;
  shots: Set<GameState["shots"][number]>;
};

function takeFrameSnapshot(state: GameState): FrameSnapshot {
  const boss = state.enemies.find((enemy) => enemy.kind === "boss");
  return {
    hp: state.hp,
    stage: state.stage,
    bank: state.bank,
    fireInMs: state.fireInMs,
    weaponLevel: state.weaponLevel,
    shieldBlocks: state.shieldBlocks,
    splits: state.splits,
    skillGauge: state.skillGauge,
    barrierMs: state.barrierMs,
    overdriveMs: state.overdriveMs,
    bombMs: state.bombMs,
    bossPatternIndex: state.bossPatternIndex,
    bossPatternMs: state.bossPatternMs,
    bossStunMs: state.bossStunMs,
    enemyCount: state.enemies.length,
    items: [...state.items],
    hasBoss: boss !== undefined,
    bossX: boss?.x ?? 0,
    bossY: boss?.y ?? 0,
    bossPhase: boss ? getBossPhase(boss) : 0,
    shots: new Set(state.shots),
  };
}

/** 한 프레임 전후 상태를 비교해 이번 프레임에 일어난 일마다 소리를 한 번씩 낸다. 잦은 소리는 gap으로 솎는다 */
function playStepSounds(
  prev: FrameSnapshot,
  state: GameState,
  now: number,
  lastPlayed: Map<keyof typeof SOUND_GAP_MS, number>,
) {
  function throttled(key: keyof typeof SOUND_GAP_MS, layers: readonly SoundLayer[]) {
    if (now - (lastPlayed.get(key) ?? -Infinity) < SOUND_GAP_MS[key]) return;
    lastPlayed.set(key, now);
    playGameSound(layers);
  }

  // fireInMs는 발사할 때만 늘어난다
  if (state.fireInMs > prev.fireInMs) throttled("fire", PLANE_SHOOTER_SOUNDS.fire[state.weapon]);
  if (prev.bank === 0 && state.bank !== 0) throttled("move", PLANE_SHOOTER_SOUNDS.move);

  // 맞은 순간 flashMs가 80으로 새로 채워진다 (그 전에 이미 dt만큼 줄어든 뒤라 80이면 이번 프레임에 맞은 것)
  for (const enemy of state.enemies) {
    if (enemy.flashMs !== 80) continue;
    if (enemy.kind === "boss") throttled("bossHit", PLANE_SHOOTER_SOUNDS.bossHit);
    else throttled("enemyHit", PLANE_SHOOTER_SOUNDS.enemyHit);
  }
  if (state.shieldBlocks > prev.shieldBlocks) throttled("shieldBlock", PLANE_SHOOTER_SOUNDS.shieldBlock);
  if (state.splits > prev.splits) playGameSound(PLANE_SHOOTER_SOUNDS.split);
  if (state.barrierMs > prev.barrierMs) playGameSound(PLANE_SHOOTER_SOUNDS.barrier);
  if (state.overdriveMs > prev.overdriveMs) playGameSound(PLANE_SHOOTER_SOUNDS.overdrive);
  if (state.bombMs > prev.bombMs) playGameSound(PLANE_SHOOTER_SOUNDS.bomb);
  if (prev.skillGauge < SKILL_GAUGE_MAX && state.skillGauge >= SKILL_GAUGE_MAX) playGameSound(PLANE_SHOOTER_SOUNDS.skillReady);
  // 칼새가 멈춘 프레임에는 경고 시간이 아직 줄지 않아 DASHER_WINDUP_MS 그대로다
  if (state.enemies.some((enemy) => enemy.kind === "dasher" && enemy.vy === 0 && enemy.timerMs === DASHER_WINDUP_MS)) {
    throttled("dasherWarn", PLANE_SHOOTER_SOUNDS.dasherWarn);
  }

  const damaged = state.hp < prev.hp;
  // 폭발은 이번 프레임에 생긴 것만 ageMs가 0이다. 들이받아 생긴 폭발은 피격음이 대신한다
  if (!damaged && state.explosions.some((explosion) => explosion.ageMs === 0)) {
    throttled("enemyDown", PLANE_SHOOTER_SOUNDS.enemyDown);
  }
  if (damaged && state.hp > 0) {
    playGameSound(state.hp === 1 ? PLANE_SHOOTER_SOUNDS.lowHp : PLANE_SHOOTER_SOUNDS.damage);
    if (state.weaponLevel < prev.weaponLevel) playGameSound(PLANE_SHOOTER_SOUNDS.levelDown);
  }
  if (state.weaponLevel === MAX_WEAPON_LEVEL && prev.weaponLevel < MAX_WEAPON_LEVEL) {
    playGameSound(PLANE_SHOOTER_SOUNDS.weaponMax);
  }

  for (const shot of state.shots) {
    if (prev.shots.has(shot)) continue;
    if (shot.fromBoss) throttled("bossShot", PLANE_SHOOTER_SOUNDS.bossShot);
    else throttled("enemyShot", PLANE_SHOOTER_SOUNDS.enemyShot);
  }

  // 사라진 아이템 중 화면 아래로 떨어진 게 아니면 먹은 것
  for (const item of prev.items) {
    if (state.items.includes(item) || item.y - item.r >= state.height) continue;
    playGameSound(item.kind === "heal" ? PLANE_SHOOTER_SOUNDS.heal : PLANE_SHOOTER_SOUNDS.weaponPickup);
  }

  if (state.stage > prev.stage) {
    playGameSound(isBossStage(prev.stage) ? PLANE_SHOOTER_SOUNDS.bossDefeat : PLANE_SHOOTER_SOUNDS.stageClear);
    if (isBossStage(state.stage)) playGameSound(PLANE_SHOOTER_SOUNDS.bossStage);
    return;
  }

  const boss = state.enemies.find((enemy) => enemy.kind === "boss");
  if (!boss) return;
  if (!prev.hasBoss) {
    playGameSound(PLANE_SHOOTER_SOUNDS.bossAppear);
    return;
  }
  if (getBossPhase(boss) > prev.bossPhase) playGameSound(PLANE_SHOOTER_SOUNDS.bossPhase);
  if (state.bossStunMs > 0 && prev.bossStunMs === 0) playGameSound(PLANE_SHOOTER_SOUNDS.bossStun);
  if (getBossPattern(state) === "laser") {
    if (prev.bossPatternMs === 0 && state.bossPatternMs > 0) playGameSound(PLANE_SHOOTER_SOUNDS.laserWarn);
    if (prev.bossPatternMs < LASER_WINDUP_MS && state.bossPatternMs >= LASER_WINDUP_MS) playGameSound(PLANE_SHOOTER_SOUNDS.laserBeam);
  }
  if (getBossPattern(state) === "summon" && state.enemies.length > prev.enemyCount) {
    throttled("summon", PLANE_SHOOTER_SOUNDS.summon);
  }
  if (state.bossPatternIndex !== prev.bossPatternIndex) playGameSound(PLANE_SHOOTER_SOUNDS.bossPattern);
  if (getBossPattern(state) !== "charge") return;
  if (prev.bossPatternMs === 0 && state.bossPatternMs > 0) playGameSound(PLANE_SHOOTER_SOUNDS.chargeWindup);
  if (prev.bossPatternMs < CHARGE_WINDUP_MS && state.bossPatternMs >= CHARGE_WINDUP_MS) {
    playGameSound(PLANE_SHOOTER_SOUNDS.chargeDash);
  }
}

/** 효과음과 같은 사건(맞힘·격추·피격·간식·스테이지·돌격)을 보고 손맛 연출을 건다. 움직임 줄이기면 흔들림·파편은 뺀다 */
function applyStepEffects(prev: FrameSnapshot, state: GameState, effects: Effects, reducedMotion: boolean) {
  const motion = !reducedMotion;
  if (state.fireInMs > prev.fireInMs) effects.muzzleMs = EFFECTS.muzzleMs;

  if (motion) {
    for (const enemy of state.enemies) {
      if (enemy.flashMs !== 80) continue;
      // 총알은 아래에서 올라오니 적의 아랫면에서 튄다
      const { count, speed } = EFFECTS.burst.hit;
      burst(effects, enemy.x, enemy.y + enemy.r * 0.7, count, ["text"], speed);
    }
  }

  const damaged = state.hp < prev.hp;
  const bossDefeated = state.stage > prev.stage && isBossStage(prev.stage);
  for (const explosion of state.explosions) {
    if (explosion.ageMs !== 0) continue;
    if (motion) {
      const { count, speed } = EFFECTS.burst.enemyDown;
      burst(effects, explosion.x, explosion.y, count, ["success", "warning", "text"], speed);
    }
    // 들이받아 같이 부서진 적은 점수가 없고, 흔들림은 피격 흔들림이 대신한다. 보스 격파 폭발은 아래에서 따로 크게 보여준다
    if (damaged || bossDefeated) continue;
    popup(effects, explosion.x, explosion.y, `+${KILL_SCORE}`, "text");
    if (motion) shake(effects, EFFECTS.shake.enemyDown.power, EFFECTS.shake.enemyDown.ms);
  }

  // 비행기 위에 띄우는 글자는 화면 밖으로 잘리지 않게 안쪽으로 당긴다
  const labelX = Math.min(state.width - 70, Math.max(70, state.planeX));
  const labelY = getPlaneY(state) - 44;

  if (damaged && state.hp > 0) {
    effects.damageFlashMs = EFFECTS.damageFlashMs;
    effects.hitStopMs = EFFECTS.hitStopMs;
    if (motion) shake(effects, EFFECTS.shake.damage.power, EFFECTS.shake.damage.ms);
    if (state.weaponLevel < prev.weaponLevel) popup(effects, labelX, labelY, "Lv -1", "danger");
  }

  if (state.barrierMs > prev.barrierMs) popup(effects, labelX, labelY, `${SKILLS.barrier.label}!`, "success");
  if (state.overdriveMs > prev.overdriveMs) popup(effects, labelX, labelY, `${SKILLS.overdrive.label}! Lv+${OVERDRIVE_LEVELS}`, "warning");
  if (state.bombMs > prev.bombMs) {
    popup(effects, state.width / 2, state.height * 0.5, `${SKILLS.bomb.label}!`, "warning", true);
    if (motion) {
      effects.ringMs = EFFECTS.ringMs;
      effects.ringX = state.planeX;
      effects.ringY = getPlaneY(state);
      shake(effects, EFFECTS.shake.gameOver.power, EFFECTS.shake.gameOver.ms);
    }
  }

  // 사라진 간식 중 화면 아래로 떨어진 게 아니면 먹은 것
  for (const item of prev.items) {
    if (state.items.includes(item) || item.y - item.r >= state.height) continue;
    const heal = item.kind === "heal";
    const levelText = state.weaponLevel === MAX_WEAPON_LEVEL ? "MAX!" : `Lv${state.weaponLevel}`;
    popup(effects, labelX, labelY, heal ? "체력 +1" : `${ITEMS[item.kind].label} ${levelText}`, heal ? "success" : "warning");
    if (motion) {
      const { count, speed } = EFFECTS.burst.pickup;
      burst(effects, item.x, item.y, count, [heal ? "success" : "warning"], speed);
    }
  }

  if (state.stage > prev.stage) {
    const bonus = bossDefeated ? BOSS_CLEAR_SCORE : STAGE_CLEAR_SCORE;
    popup(effects, state.width / 2, state.height * 0.56, `+${formatScore(bonus)}`, "warning", true);
    if (bossDefeated) {
      popup(effects, state.width / 2, state.height * 0.56 - 40, "보스 격파!", "danger", true);
      popup(effects, labelX, labelY, `무기 Lv +${BOSS_REWARD_LEVELS}`, "warning");
      if (motion) {
        const { count, speed } = EFFECTS.burst.gameOver;
        burst(effects, prev.bossX, prev.bossY, count, ["warning", "danger", "text"], speed);
        shake(effects, EFFECTS.shake.bossClear.power, EFFECTS.shake.bossClear.ms);
      }
    }
    return;
  }

  const boss = state.enemies.find((enemy) => enemy.kind === "boss");
  if (boss && prev.bossStunMs === 0 && state.bossStunMs > 0) {
    popup(effects, state.width / 2, state.height * 0.32, "기절! 약점 3배", "warning", true);
  }
  if (boss && prev.hasBoss && getBossPhase(boss) > prev.bossPhase) {
    popup(effects, state.width / 2, state.height * 0.4, getBossPhase(boss) === 3 ? "보스 분노!" : "보스 2페이즈", "danger", true);
    if (motion) shake(effects, EFFECTS.shake.chargeDash.power, EFFECTS.shake.chargeDash.ms);
  }

  const dashStarted =
    prev.hasBoss &&
    getBossPattern(state) === "charge" &&
    prev.bossPatternMs < CHARGE_WINDUP_MS &&
    state.bossPatternMs >= CHARGE_WINDUP_MS;
  if (motion && dashStarted) shake(effects, EFFECTS.shake.chargeDash.power, EFFECTS.shake.chargeDash.ms);
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height = width,
) {
  if (!isSpriteReady(image)) return;
  ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
}

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState, sprites: SpriteImages, scrollMs: number) {
  const background = sprites[getBackgroundSpriteKey(state.stage)];
  if (!isSpriteReady(background)) {
    ctx.clearRect(0, 0, state.width, state.height);
    return;
  }
  // 가로를 꽉 채우고, 세로로 이어 붙여 아래로 흘려보낸다 (위아래가 이어지게 만든 타일)
  const tileHeight = background.naturalHeight * (state.width / background.naturalWidth);
  const offset = ((scrollMs / 1000) * BACKGROUND_SCROLL_SPEED) % tileHeight;
  for (let y = offset - tileHeight; y < state.height; y += tileHeight) {
    ctx.drawImage(background, 0, y, state.width, tileHeight);
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  sprites: SpriteImages,
  palette: Palette,
  clockMs: number,
  reducedMotion: boolean,
  effects: Effects,
  /** 격추당한 뒤 지난 시간. 살아 있으면 null */
  deathMs: number | null,
) {
  // 움직임 줄이기 설정이면 배경 스크롤·불꽃 깜빡임·아이템 맥동을 멈춘다
  drawBackground(ctx, state, sprites, reducedMotion ? 0 : clockMs);

  // 배경은 두고 그 위 세상만 흔든다 (배경까지 흔들면 가장자리에 빈 틈이 보인다)
  const offset = shakeOffset(effects);
  ctx.save();
  ctx.translate(offset.x, offset.y);

  const boss = state.enemies.find((enemy) => enemy.kind === "boss");
  if (boss && getBossPattern(state) === "charge" && state.bossPatternMs > 0 && state.bossPatternMs < CHARGE_WINDUP_MS) {
    // 돌격 예고: 보스가 내리꽂을 길을 붉게 칠해 옆으로 비켜날 시간을 준다
    const homeY = getBossHomeY(state);
    ctx.fillStyle = palette.danger;
    ctx.globalAlpha = reducedMotion ? 0.3 : 0.22 + 0.1 * Math.sin(clockMs / 90);
    ctx.fillRect(state.bossChargeX - boss.r, homeY, boss.r * 2, state.height - homeY);
    ctx.globalAlpha = 1;
  }

  if (boss && getBossPattern(state) === "laser" && state.bossStunMs <= 0) {
    const top = boss.y + boss.r * 0.6;
    if (state.bossPatternMs > 0 && state.bossPatternMs < LASER_WINDUP_MS) {
      // 레이저 예고: 쏘기 시작할 자리에 가는 붉은 선
      ctx.fillStyle = palette.danger;
      ctx.globalAlpha = reducedMotion ? 0.5 : 0.35 + 0.25 * Math.sin(clockMs / 60);
      ctx.fillRect(state.bossLaserX - 2, top, 4, state.height - top);
    } else if (isLaserActive(state)) {
      // 레이저: 붉은 테두리에 밝은 노란 심지
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = palette.danger;
      ctx.fillRect(state.bossLaserX - LASER_HALF_WIDTH, top, LASER_HALF_WIDTH * 2, state.height - top);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = palette.warning;
      ctx.fillRect(state.bossLaserX - LASER_HALF_WIDTH / 3, top, (LASER_HALF_WIDTH * 2) / 3, state.height - top);
    }
    ctx.globalAlpha = 1;
  }

  for (const item of state.items) {
    const pulse = reducedMotion ? 1 : 1 + 0.08 * Math.sin(clockMs / 180 + item.x);
    drawSprite(ctx, sprites[ITEM_SPRITES[item.kind]], item.x, item.y, item.r * ITEM_SIZE_RATIO * pulse);
  }

  for (const enemy of state.enemies) {
    if (enemy.kind !== "dasher" || enemy.vy !== 0) continue;
    // 칼새 돌진 예고: 내리꽂을 줄을 붉게 칠해 옆으로 비켜날 시간을 준다
    ctx.fillStyle = palette.danger;
    ctx.globalAlpha = reducedMotion ? 0.28 : 0.2 + 0.1 * Math.sin(clockMs / 70);
    ctx.fillRect(enemy.x - enemy.r, enemy.y, enemy.r * 2, state.height - enemy.y);
  }
  ctx.globalAlpha = 1;

  for (const enemy of state.enemies) {
    const sprite = ENEMY_SPRITES[enemy.kind];
    drawSprite(ctx, sprites[enemy.flashMs > 0 ? sprite.hit : sprite.normal], enemy.x, enemy.y, enemy.r * ENEMY_SIZE_RATIO);
    if (isShieldUp(enemy)) {
      // 아르마딜로가 든 방패: 아래쪽 반원. 쏠 때 잠깐 사라진다
      ctx.strokeStyle = palette.text;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.r * 1.3, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (enemy.kind !== "boss") continue;
    if (isBossGuarding(state)) {
      // 보스 앞 방패: 정면을 넓게 가린 굵은 반원 (옆은 비어 있다)
      ctx.strokeStyle = palette.text;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.r * 1.15, Math.PI * 0.3, Math.PI * 0.7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (state.bossStunMs > 0) {
      // 기절: 머리 위를 도는 별 세 개
      ctx.fillStyle = palette.warning;
      for (let index = 0; index < 3; index += 1) {
        const angle = (reducedMotion ? 0 : clockMs / 300) + (index * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(enemy.x + Math.cos(angle) * enemy.r * 0.55, enemy.y - enemy.r * 0.9 + Math.sin(angle) * 8, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (const explosion of state.explosions) {
    const frame = Math.min(EXPLOSION_FRAMES.length - 1, Math.floor((explosion.ageMs / EXPLOSION_MS) * EXPLOSION_FRAMES.length));
    drawSprite(ctx, sprites[EXPLOSION_FRAMES[frame]], explosion.x, explosion.y, explosion.size);
  }

  for (const bullet of state.bullets) {
    const { sprite, width, height } = BULLET_SPRITES[bullet.weapon];
    // 고레벨 관통탄은 굵어진 판정만큼 그림도 키운다
    const scale = bullet.r / BULLET_RADIUS[bullet.weapon];
    drawSprite(ctx, sprites[sprite], bullet.x, bullet.y, width * scale, height * scale);
  }

  for (const shot of state.shots) {
    drawSprite(ctx, sprites[shot.fromBoss ? SHOT_SPRITES.boss : SHOT_SPRITES.enemy], shot.x, shot.y, shot.r * SHOT_SIZE_RATIO);
  }

  const x = state.planeX;
  const y = getPlaneY(state);
  if (deathMs === null) {
    if (state.overdriveMs > 0) {
      // 폭주 중: 비행기 뒤에 노란 기운
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = palette.warning;
      ctx.beginPath();
      ctx.arc(x, y, PLANE_SIZE * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    // 맞은 뒤 무적 시간에는 어지러워하는 조종사 그림 + 반투명 (깜빡임은 광과민 우려로 쓰지 않는다)
    ctx.globalAlpha = state.invincibleMs > 0 ? 0.7 : 1;
    const flame = reducedMotion ? 0 : Math.floor(clockMs / FLAME_FRAME_MS) % FLAME_FRAMES.length;
    drawSprite(ctx, sprites[FLAME_FRAMES[flame]], x, y + PLANE_SIZE / 2 + FLAME_HEIGHT / 2 - 6, FLAME_WIDTH, FLAME_HEIGHT);
    const planeSprite =
      state.invincibleMs > 0
        ? PLANE_SPRITES.hurt
        : state.bank < 0
          ? PLANE_SPRITES.left
          : state.bank > 0
            ? PLANE_SPRITES.right
            : PLANE_SPRITES.center;
    drawSprite(ctx, sprites[planeSprite], x, y, PLANE_SIZE);
    if (effects.muzzleMs > 0 && !reducedMotion) {
      // 총구 불꽃: 쏠 때마다 기수 끝이 작게 번쩍인다
      ctx.globalAlpha = (effects.muzzleMs / EFFECTS.muzzleMs) * 0.8;
      ctx.fillStyle = palette.warning;
      ctx.beginPath();
      ctx.arc(x, y - PLANE_SIZE / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.barrierMs > 0) {
      // 방어막: 비행기를 감싼 원. 끝나갈 무렵(0.6초)부터 서서히 흐려진다
      ctx.globalAlpha = Math.min(1, state.barrierMs / 600) * 0.8;
      ctx.strokeStyle = palette.success;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, BARRIER_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (deathMs < PLANE_EXPLOSION_MS) {
    // 격추당하면 비행기 대신 크게 터지는 폭발을 보여준다
    const frame = Math.min(EXPLOSION_FRAMES.length - 1, Math.floor((deathMs / PLANE_EXPLOSION_MS) * EXPLOSION_FRAMES.length));
    drawSprite(ctx, sprites[EXPLOSION_FRAMES[frame]], x, y, PLANE_EXPLOSION_SIZE);
  }

  drawEffects(ctx, effects, palette, palette.font, !reducedMotion);
  ctx.restore();
  // 붉은 테두리와 스테이지 배너는 흔들리지 않게 흔들림을 되돌린 뒤 그린다
  drawDamageFlash(ctx, effects, state.width, state.height, palette.danger);

  if (state.bannerMs > 0) {
    const bossStage = getStageConfig(state.stage).boss;
    // 일반 스테이지는 경례하는 카피바라, 보스 스테이지는 헬멧 쓰고 긴장한 카피바라
    drawSprite(
      ctx,
      sprites[bossStage ? CAPYBARA_SPRITES.bossBanner : CAPYBARA_SPRITES.stageBanner],
      state.width / 2,
      state.height * 0.42 - 84,
      BANNER_CAPYBARA_SIZE,
    );
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.text;
    ctx.font = `bold 36px ${palette.font}`;
    ctx.fillText(`스테이지 ${state.stage}`, state.width / 2, state.height * 0.42);
    ctx.font = `600 16px ${palette.font}`;
    ctx.fillText(
      bossStage ? "카이만 보스를 격파하세요" : "천적들을 모두 격추하세요",
      state.width / 2,
      state.height * 0.42 + 36,
    );
  }
}

export function CapybaraPlaneShooter() {
  const records = usePlaneShooterRecords();
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdownIndex, setCountdownIndex] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef({ left: false, right: false });
  const dragRef = useRef<{ pointerX: number; planeX: number; targetX: number } | null>(null);
  const stateRef = useRef<GameState | null>(null);
  /** 게임 좌표 1px이 화면에서 몇 CSS px인지. 드래그 거리를 게임 좌표로 바꿀 때 쓴다 */
  const scaleRef = useRef(1);
  /** rAF 루프는 렌더링과 상관없이 돌아서 멈춤 여부를 ref로 읽는다 */
  const pausedRef = useRef(false);
  /** 결과 화면이 뜬 시각. 드래그하던 손을 떼는 click이 곧바로 새 판을 열지 않게 잠깐 탭을 무시하는 기준 */
  const resultAtRef = useRef(0);
  /** 버튼·키로 요청한 스킬. rAF 루프가 다음 step에 넘기고 비운다 */
  const skillRef = useRef<SkillKind | null>(null);
  const { ref: recordsRef, inView: recordsVisible } = useInView<HTMLElement>(phase === "result");
  useLockPageScroll(phase === "countdown" || phase === "playing");

  // 멈출 때 입력을 비운다 — 방향키를 누른 채 멈추면 keyup을 놓쳐 이어할 때 한쪽으로 흘러간다
  function changePaused(next: boolean) {
    pausedRef.current = next;
    setPaused(next);
    if (next) {
      keysRef.current = { left: false, right: false };
      dragRef.current = null;
    }
  }

  // 시작 화면에서 미리 불러와 카운트다운이 끝날 때쯤 준비되게 한다
  useEffect(() => {
    void loadSprites();
  }, []);

  // 순위표가 올라올 때 슈욱 (반응속도 테스트와 같게)
  useEffect(() => {
    if (recordsVisible) playGameSound(GAME_SOUNDS.whoosh);
  }, [recordsVisible]);

  // 3·2·1 숫자가 바뀔 때마다 한 박
  useEffect(() => {
    if (phase === "countdown") playGameSound(GAME_SOUNDS.countdown);
  }, [phase, countdownIndex]);

  useEffect(() => {
    if (phase !== "countdown") return;

    const timers = COUNTDOWN_VALUES.map((_, index) =>
      setTimeout(() => {
        if (index < COUNTDOWN_VALUES.length - 1) {
          setCountdownIndex(index + 1);
          return;
        }
        playGameSound(GAME_SOUNDS.go);
        setPhase("playing");
      }, COUNTDOWN_STEP_MS * (index + 1)),
    );

    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const finishRound = useEffectEvent((score: number, stage: number) => {
    changePaused(false);
    const now = Date.now();
    resultAtRef.current = now;
    const record = { id: String(now), score, stage, at: now };
    const rank = getRank(records, record);
    // 게임 오버 소리는 격추당한 순간 이미 냈다
    if (rank === 1) playGameSound(PLANE_SHOOTER_SOUNDS.newRecord);
    saveRecords(insertRecord(records, record));
    void submitGameRecord("capybara-plane-shooter", record.score, record);
    setResult({ score, stage, recordId: record.id, rank });
    setPhase("result");
  });

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const palette = readPalette(canvas);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      if (!canvas || !ctx) return;
      // 캔버스 픽셀은 화면 크기에 맞추고, 그리기는 고정된 게임 좌표로 한다
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      scaleRef.current = canvas.clientWidth / GAME_WIDTH;
      const pixelScale = ratio * scaleRef.current;
      ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
      stateRef.current ??= createState(GAME_WIDTH, GAME_HEIGHT);
    }

    stateRef.current = null;
    dragRef.current = null;
    resize();
    window.addEventListener("resize", resize);

    let cancelled = false;
    let frameId = 0;

    void loadSprites().then((sprites) => {
      if (cancelled) return;
      const startAt = performance.now();
      let lastAt = startAt;
      let lastHudKey = "";
      const lastPlayed = new Map<keyof typeof SOUND_GAP_MS, number>();
      const effects = createEffects();
      /** 격추당한 뒤 지난 시간. 살아 있으면 null — 이 동안 세상은 멈추고 폭발만 보여준 뒤 결과로 넘어간다 */
      let deathMs: number | null = null;

      function tick(now: number) {
        const state = stateRef.current;
        if (!state || !ctx) return;
        // rAF가 넘기는 now는 프레임 시작 시각이라 startAt보다 앞설 수 있다. 음수면 애니메이션 프레임 번호가 -1이 되어 그림을 못 찾는다
        const clockMs = Math.max(0, now - startAt);
        const render = () => draw(ctx, state, sprites, palette, clockMs, reducedMotion, effects, deathMs);
        if (pausedRef.current) {
          // step은 건너뛰고 기준 시각만 옮긴다 → 이어할 때 시간이 튀지 않음. 멈춘 동안 resize로 캔버스가 지워져도 다시 그림
          lastAt = now;
          render();
          frameId = requestAnimationFrame(tick);
          return;
        }
        // rAF는 백그라운드 탭에서 멈춘다. 돌아왔을 때 게임도 연출도 한 번에 튀지 않게 프레임 간격에 상한을 둔다
        const frameMs = Math.min(Math.max(now - lastAt, 0), MAX_FRAME_MS);
        lastAt = now;
        updateEffects(effects, frameMs);

        if (deathMs !== null) {
          deathMs += frameMs;
          render();
          if (deathMs >= GAME_OVER_MS) {
            finishRound(state.score, state.stage);
            return;
          }
          frameId = requestAnimationFrame(tick);
          return;
        }

        // 맞은 순간 잠깐 게임을 멈춘다 (연출 시간만 흐른다). 멈춘 동안 step을 건너뛰어 같은 사건을 두 번 보지 않는다
        if (effects.hitStopMs > 0) {
          render();
          frameId = requestAnimationFrame(tick);
          return;
        }

        const { left, right } = keysRef.current;
        const input: GameInput = {
          direction: left === right ? 0 : left ? -1 : 1,
          targetX: dragRef.current?.targetX ?? null,
          skill: skillRef.current,
        };
        skillRef.current = null;
        const before = takeFrameSnapshot(state);
        step(state, frameMs, input);
        // 게이지가 모자라 스킬이 안 나갔으면 삐빅 (썼으면 비용만큼 줄어 이전보다 작다)
        if (input.skill && state.skillGauge >= before.skillGauge) playGameSound(GAME_SOUNDS.wrong);
        playStepSounds(before, state, now, lastPlayed);
        applyStepEffects(before, state, effects, reducedMotion);

        if (state.hp <= 0) {
          deathMs = 0;
          playGameSound(PLANE_SHOOTER_SOUNDS.gameOver);
          effects.damageFlashMs = EFFECTS.damageFlashMs;
          if (!reducedMotion) {
            const { count, speed } = EFFECTS.burst.gameOver;
            burst(effects, state.planeX, getPlaneY(state), count, ["warning", "danger", "text"], speed);
            shake(effects, EFFECTS.shake.gameOver.power, EFFECTS.shake.gameOver.ms);
          }
        }
        render();

        // HUD는 값이 바뀔 때만 다시 그린다
        const nextHud = readHud(state);
        const hudKey = Object.values(nextHud).join("|");
        if (hudKey !== lastHudKey) {
          lastHudKey = hudKey;
          setHud(nextHud);
        }
        frameId = requestAnimationFrame(tick);
      }

      frameId = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, [phase]);

  function requestSkill(kind: SkillKind) {
    if (phase !== "playing" || pausedRef.current) return;
    skillRef.current = kind;
  }

  function startCountdown() {
    changePaused(false);
    skillRef.current = null;
    keysRef.current = { left: false, right: false };
    setHud(null);
    setCountdownIndex(0);
    setPhase("countdown");
  }

  // 드래그는 손가락이 움직인 거리만큼 비행기를 옮긴다 (손가락이 비행기를 가리지 않게)
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const state = stateRef.current;
    if (phase !== "playing" || !state || pausedRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, planeX: state.planeX, targetX: state.planeX };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (phase !== "playing" || !drag) return;
    drag.targetX = drag.planeX + (event.clientX - drag.pointerX) / scaleRef.current;
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  // 시작/재시작은 click으로 받아 스크롤하려고 끄는 동작에는 반응하지 않게 한다
  function handleClick() {
    if (phase !== "idle" && phase !== "result") return;
    // 결과 직후의 click은 드래그하던 손을 뗀 것일 수 있다 — 결과를 보기도 전에 새 판이 열리지 않게 잠깐 무시한다
    if (phase === "result" && Date.now() - resultAtRef.current < RESULT_TAP_GUARD_MS) return;
    playGameSound(GAME_SOUNDS.start);
    startCountdown();
  }

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    const pressed = event.type === "keydown";
    const skill = (Object.keys(SKILL_KEYS) as SkillKind[]).find((kind) => SKILL_KEYS[kind].keys.includes(event.key));
    if (skill) {
      if (phase !== "playing" || pausedRef.current) return;
      event.preventDefault();
      if (pressed && !event.repeat) requestSkill(skill);
      return;
    }
    if (LEFT_KEYS.has(event.key) || RIGHT_KEYS.has(event.key)) {
      if (phase !== "playing" || pausedRef.current) return;
      event.preventDefault();
      if (LEFT_KEYS.has(event.key)) keysRef.current.left = pressed;
      else keysRef.current.right = pressed;
      return;
    }

    if (!pressed || event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    if (event.target instanceof HTMLElement && event.target.closest("a, button, input, textarea, select")) {
      return;
    }
    event.preventDefault();
    handleClick();
  });

  useEffect(() => {
    // 방향키를 누른 채 다른 창으로 가면 keyup을 못 받아 비행기가 한쪽으로 계속 흘러가므로 누른 방향을 비운다
    const releaseKeys = () => {
      keysRef.current = { left: false, right: false };
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    window.addEventListener("blur", releaseKeys);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
      window.removeEventListener("blur", releaseKeys);
    };
  }, []);

  const tier = result ? getPlaneShooterTier(result.stage) : null;

  const screenClass =
    phase === "countdown"
      ? "bg-success text-neutral-950"
      : phase === "result" && tier && !recordsVisible
        ? cn(tier.bgClass, tier.fgClass)
        : "bg-background text-foreground";

  const shareText =
    phase === "result" && result && tier
      ? `${TITLE}에서 스테이지 ${result.stage}까지 가서 ${formatScore(result.score)}점, ${tier.label} 등급이 나왔어요. 나보다 멀리 갈 수 있나요?`
      : `간식으로 무기를 바꿔 가며 천적들을 격추하고 카이만 보스를 버티는 ${TITLE}, 같이 해 봐요`;

  const liveMessage =
    phase === "countdown"
      ? `${COUNTDOWN_VALUES[countdownIndex]}`
      : phase === "playing" && hud
        ? `스테이지 ${hud.stage}, 체력 ${hud.hp}`
        : phase === "result" && result && tier
          ? `${result.rank}위, ${formatScore(result.score)}점, 스테이지 ${result.stage}, ${tier.label} 등급`
          : "";

  return (
    <div
      data-testid="capybara-plane-shooter-screen"
      data-phase={phase}
      data-paused={paused}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      className={cn(
        "relative flex min-h-dvh w-full cursor-pointer select-none flex-col items-center justify-center overflow-hidden px-5 py-10 transition-colors [-webkit-tap-highlight-color:transparent]",
        phase === "playing" ? "h-dvh touch-none" : "touch-manipulation",
        phase === "result" ? "duration-700" : "duration-200",
        screenClass,
      )}
    >
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {phase === "idle" && (
        <ShareButton
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]"
          title={TITLE}
          text={shareText}
        />
      )}

      {phase === "idle" && (
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <header className="flex flex-col items-center gap-2">
            <Image
              src={SPRITES[CAPYBARA_SPRITES.hero]}
              alt="유자를 머리에 얹고 고글 모자를 쓴 카피바라 조종사"
              width={144}
              height={144}
              priority
            />
            {/* 좌우 여백: 좁은 폰에서 제목이 오른쪽 위 공유 버튼 밑으로 들어가지 않게 */}
            <h1 className="px-12 text-title-1 font-bold text-text-strong">{TITLE}</h1>
            <p className="text-caption-1 text-balance text-text-caption">
              카피바라 조종사가 풀잎탄을 자동으로 쏴요. 화면을 좌우로 드래그하거나 방향키로 움직여 하피독수리·말벌·재규어를 격추하세요. 스테이지가 오르면 방패로 막는 아르마딜로, 경고선 뒤 내리꽂는 칼새, 둘로 갈라지는 독화살개구리, 따라오는 흡혈박쥐도 나와요. 떨어진 간식을 먹으면 무기가 바뀌고 무기 레벨이 {MAX_WEAPON_LEVEL}레벨까지 올라 탄이 점점 많아져요. 맞으면 레벨이 하나 내려가요. 격추할수록 스킬 게이지가 차서 방어막(Z)·폭주(X)·폭탄(C)을 오른쪽 아래 버튼으로 쓸 수 있어요. 5스테이지마다 나오는 카이만 보스는 체력이 줄수록 거세지고 레이저·부하 소환·앞 방패도 써요. 돌격 뒤 기절했을 때 쏘면 피해가 3배예요. 격파해서 무기 레벨을 {BOSS_REWARD_LEVELS} 올리세요. 체력은 {MAX_HP}칸이에요.
            </p>
          </header>

          <p className="text-title-1 font-bold text-text-strong">클릭해서 시작하세요</p>

          <PlaneShooterLeaderboard records={records} />
        </div>
      )}

      {phase !== "idle" && <h1 className="sr-only">{TITLE}</h1>}

      {phase === "countdown" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            key={countdownIndex}
            data-testid="countdown"
            className="animate-in fade-in zoom-in-50 animation-duration-300 text-[11rem] font-black leading-none tabular-nums sm:text-[15rem]"
          >
            {COUNTDOWN_VALUES[countdownIndex]}
          </span>
          <p className="text-title-3 font-semibold opacity-80">좌우로 움직여 적을 격추하세요</p>
        </div>
      )}

      {phase === "playing" && (
        // 넓은 화면의 바깥 여백: 지금 스테이지 배경을 크게 흐리고 어둡게 깔아 몰입감은 유지한다
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
          style={{ backgroundImage: `url(${SPRITES[getBackgroundSpriteKey(hud?.stage ?? 1)]})` }}
        />
      )}

      {phase === "playing" && (
        // 기기마다 보이는 범위가 달라지면 넓은 화면이 유리하다. 플레이 영역은 고정 비율(GAME_WIDTH:GAME_HEIGHT)
        // 그대로 화면에 들어가는 최대 크기로 가운데 두고, 남는 곳은 흐린 배경이 채운다 (전체 화면 원칙의 예외, 사용자 요청)
        // 습지 배경은 어두운 그림이라 테마와 상관없이 플레이 화면은 다크 토큰으로 글자를 그린다
        // 크기는 Tailwind 임의값 클래스가 생성되지 않아 인라인 스타일로 고정한다
        <div
          data-testid="play-area"
          className="dark absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden text-foreground shadow-2xl"
          style={{
            width: `min(100vw, calc(100dvh * ${GAME_WIDTH} / ${GAME_HEIGHT}))`,
            height: `min(100dvh, calc(100vw * ${GAME_HEIGHT} / ${GAME_WIDTH}))`,
          }}
        >
          <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full" />
          {hud && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex min-h-11 w-full items-start justify-between gap-3 px-16">
                <div className="flex flex-col gap-1">
                  <p className="flex gap-0.5" aria-label={`체력 ${hud.hp}/${MAX_HP}`}>
                    {Array.from({ length: MAX_HP }, (_, index) => (
                      <Heart
                        key={index}
                        aria-hidden="true"
                        className={cn("size-5 text-destructive", index < hud.hp ? "fill-current" : "opacity-40")}
                      />
                    ))}
                  </p>
                  <p className="text-caption-2 font-semibold whitespace-nowrap">{ITEMS[hud.weapon].label}</p>
                </div>
                <p className="text-title-3 font-bold tabular-nums">{formatScore(hud.score)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1 px-4">
                <p className="whitespace-nowrap rounded-full bg-black/30 px-3 py-1 text-caption-1 font-bold tabular-nums">
                  스테이지 {hud.stage} ·{" "}
                  {isBossStage(hud.stage) ? "카이만 보스 격파" : `남은 적 ${hud.killsLeft}`}
                </p>
                {hud.bossPattern && (
                  <p className="whitespace-nowrap rounded-full bg-destructive/85 px-2.5 py-0.5 text-caption-2 font-bold text-white">
                    {hud.bossPattern}
                  </p>
                )}
              </div>
              {hud.bossHp !== null && (
                // 보스 체력바: 체력이 2/3·1/3 아래로 떨어질 때마다 페이즈가 오른다
                <Progress
                  value={hud.bossHp}
                  size="sm"
                  aria-label="카이만 보스 체력"
                  className="w-40 bg-black/40 [&>*]:bg-destructive"
                />
              )}
            </div>
          )}
          {hud && (
            // 오른쪽 가장자리 세로 게이지: 간식을 먹을 때마다 아래부터 한 칸씩 찬다
            <div
              role="img"
              aria-label={`무기 레벨 ${hud.weaponLevel}/${MAX_WEAPON_LEVEL}`}
              className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 flex-col items-center gap-1"
            >
              <span className="text-caption-2 font-black tabular-nums">
                {hud.overdrive ? SKILLS.overdrive.label : hud.weaponLevel === MAX_WEAPON_LEVEL ? "MAX" : `Lv${hud.weaponLevel}`}
              </span>
              <span className="flex flex-col-reverse gap-0.5 rounded-full bg-black/30 p-1">
                {Array.from({ length: MAX_WEAPON_LEVEL }, (_, index) => (
                  <span
                    key={index}
                    className={cn("h-3 w-2.5 rounded-sm", index < hud.weaponLevel ? "bg-warning" : "bg-foreground/20")}
                  />
                ))}
              </span>
            </div>
          )}
          {hud && (
            // 오른쪽 아래 스킬: 게이지 + 버튼 세 개. 누르는 동작이 뒤의 드래그·시작으로 새지 않게 막는다
            <div
              className="absolute right-2 bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-2"
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
            >
              <Progress
                value={hud.skillGauge}
                size="sm"
                aria-label={`스킬 게이지 ${hud.skillGauge}/${SKILL_GAUGE_MAX}`}
                className="w-11 bg-black/40 [&>*]:bg-warning"
              />
              {(Object.keys(SKILL_KEYS) as SkillKind[]).map((kind) => {
                const ready = hud.skillGauge >= SKILLS[kind].cost;
                const active = (kind === "barrier" && hud.barrier) || (kind === "overdrive" && hud.overdrive);
                const Icon = SKILL_ICONS[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-label={`${SKILLS[kind].label} (${SKILL_KEYS[kind].key}), 게이지 ${SKILLS[kind].cost} 필요`}
                    aria-disabled={!ready}
                    aria-keyshortcuts={SKILL_KEYS[kind].key}
                    onClick={() => requestSkill(kind)}
                    className={cn(
                      "flex size-11 cursor-pointer touch-manipulation flex-col items-center justify-center rounded-full bg-black/40 text-white transition-opacity focus-visible:outline-2 focus-visible:outline-warning",
                      !ready && "opacity-40",
                      active && "ring-2 ring-warning",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    <span className="text-caption-3 leading-none font-bold tabular-nums">{SKILLS[kind].cost}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {phase === "result" && result && tier && (
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <section
            data-testid="result-hero"
            className="flex min-h-[calc(100dvh-5rem)] w-full flex-col items-center justify-center gap-6"
          >
            <div className="flex flex-col items-center gap-3">
              <Image
                src={SPRITES[TIER_SPRITES[PLANE_SHOOTER_TIERS.indexOf(tier)]]}
                alt={`${tier.label} 등급 카피바라`}
                width={120}
                height={120}
              />
              <p data-testid="result-tier" className="rounded-full bg-black/15 px-4 py-1 text-caption-1 font-bold">
                {tier.label}
              </p>
              <p className="flex items-baseline gap-2 font-black tabular-nums">
                <span data-testid="result-score" className="text-[5rem] leading-none sm:text-[7rem]">
                  {formatScore(result.score)}
                </span>
                <span className="text-title-1">점</span>
              </p>
              <p data-testid="result-rank" className="text-title-2 font-bold tabular-nums">
                {result.rank}위
              </p>
            </div>

            <p data-testid="result-summary" className="text-title-3 font-semibold text-balance">
              {tier.label} 스테이지 {result.stage} 도달, {tier.description}
            </p>

            <div
              className="flex cursor-default items-center gap-3 rounded-full bg-black/10 py-1.5 pr-1.5 pl-5"
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
            >
              <p className="text-caption-1 font-semibold">이 기록을 친구에게 공유할까요?</p>
              <ShareButton title={TITLE} text={shareText} />
            </div>

            <div className="flex flex-col items-center gap-1 opacity-80">
              <p className="text-caption-1 font-semibold">탭해서 다시 도전</p>
              <p className="flex items-center gap-1 text-caption-2 font-medium">
                <ChevronDown aria-hidden="true" className="size-4" />
                아래로 내리면 순위 기록이 나와요
              </p>
            </div>
          </section>

          <section
            ref={recordsRef}
            data-testid="result-records"
            data-visible={recordsVisible}
            onPointerDown={stopPropagation}
            onClick={stopPropagation}
            className={cn(
              "flex w-full cursor-default flex-col gap-6 pb-6 transition-[opacity,translate] duration-700",
              recordsVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0",
            )}
          >
            <PlaneShooterLeaderboard records={records} highlightId={result.recordId} />
            <AdSlot placement="capybara-plane-shooter-result" />
          </section>
        </div>
      )}

      <GameControls
        className={phase === "playing" ? "dark text-foreground" : undefined}
        pause={
          phase === "playing"
            ? {
                paused,
                onPause: () => changePaused(true),
                onResume: () => changePaused(false),
                onRestart: startCountdown,
              }
            : undefined
        }
      />
    </div>
  );
}

export default CapybaraPlaneShooter;
