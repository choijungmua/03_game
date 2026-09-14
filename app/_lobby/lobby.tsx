"use client";

// 캔버스용 new Image()와 이름이 겹치지 않게 NextImage로 가져온다
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { cn } from "@/lib";

import {
  BUILDING_ASSETS,
  GROUND_ASSETS,
  type GroundId,
  lobbyAssetSrc,
  SPRITE_ASSETS,
  type SpriteAsset,
  type SpriteId,
} from "@/lib/lobby/assets";
import { ATTACK_COOLDOWN_MS, ATTACK_MS, type PresenceResponse } from "@/lib/lobby/presence";
import {
  BODY_LAYERS,
  HEAD_ELLIPSE,
  loadOutfit,
  type Outfit,
  OVER_HEAD_LAYERS,
  SLOT_INFO,
  type WardrobeAnchor,
  type WardrobeSlot,
  wardrobeSrc,
  VIEW_OF,
  WORLD_ANCHORS,
  WORLD_HEAD_ELLIPSE,
} from "@/lib/lobby/wardrobe";
import {
  type Building,
  BUILDING_WIDTH,
  createWorld,
  DIRECTIONS,
  type Direction,
  type Door,
  type DoorGame,
  type Facing,
  FACING_VECTORS,
  FACINGS,
  hash2,
  isBlockingTile,
  LOBBY_SEED,
  SPRING_RADIUS,
  TILE,
  type Tile,
  toDirection,
  WALK_SPEED,
} from "@/lib/lobby/world";

import { Wardrobe } from "./wardrobe";

type Pose = "stand" | "walk1" | "walk2";
type SpriteKey =
  | `${Pose}-${Facing}`
  | `sit-${Direction}`
  | `punch-${Direction}`
  | "stun"
  | ScratchFrame
  | `${Exclude<IdleFrame, ScratchFrame>}-${Direction}`;
/** 가만히 서 있을 때 돌아가며 하는 동작의 프레임. 긁기는 뒷모습 한 벌, 하품·졸기는 바라보는 방향(상하좌우)마다 따로 있다 */
type ScratchFrame = `scratch-${1 | 2 | 3}`;
type IdleFrame = ScratchFrame | `yawn-${1 | 2 | 3}` | `doze-${1 | 2}`;
type Texture = GroundId;

interface CapybaraLook {
  pose: Pose;
  sitting: boolean;
  stunned: boolean;
  /** 때리기 진행도 0→1. 안 때리면 -1 */
  attack: number;
  /** 걷는 중 누적 거리(px). 걸음마다 몸이 들썩이는 박자에 쓴다. 0이면 서 있음 */
  stride: number;
  /** 대기 동작(긁기·하품·졸기) 프레임. 쉬는 중이 아니면 null */
  idle: IdleFrame | null;
}

interface Remote {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: Facing;
  sitting: boolean;
  walkDist: number;
  idleMs: number;
  stunUntil: number;
  attackUntil: number;
  outfit: Outfit;
}

interface Chunk {
  tiles: Tile[];
  canvas: HTMLCanvasElement | null;
  /** 텍스처가 다 로드된 뒤 구웠는지. 아니면 로드 후 다시 굽는다 */
  textured: boolean;
}

const POSES: readonly Pose[] = ["stand", "walk1", "walk2"];
// 3장으로 4박자 걷기: 한 발 → 모음 → 다른 발 → 모음
const WALK_CYCLE: readonly Pose[] = ["walk1", "stand", "walk2", "stand"];
/** 걸음 한 프레임당 이동 거리(px). 시간이 아니라 거리로 넘겨서 느리게 걸으면 발도 느리게 움직인다 (최고 속도에서 약 125ms) */
const STRIDE_PX = 30;
/** 조이스틱: 이만큼 끌면 최고 속도, 이보다 짧으면 무시 */
const JOYSTICK_RADIUS = 56;
const JOYSTICK_DEADZONE = 8;
/** 통나무에 앉고 일어날 때 폴짝 옮겨 가는 시간 */
const HOP_MS = 260;
/** 걷는 중 방향이 바뀌려면 새 방향이 이만큼 유지돼야 한다 (대각선 키를 떼는 순간의 깜빡임 방지) */
const FACING_HOLD_MS = 90;
const UI_BASE = "/assets/images/ui/lobby";
/** 가만히 서 있으면 3.5초 쉬었다가 엉덩이 긁기 → 하품·기지개 → 꾸벅꾸벅 졸기를 돌아가며 한다 */
const IDLE_WAIT_MS = 3500;
const IDLE_ACTIONS: readonly { action: "scratch" | "yawn" | "doze"; ms: number }[] = [
  { action: "scratch", ms: 2200 },
  { action: "yawn", ms: 2000 },
  { action: "doze", ms: 3000 },
];
const IDLE_CYCLE_MS = IDLE_ACTIONS.reduce((sum, { ms }) => sum + IDLE_WAIT_MS + ms, 0);
/** 누른 곳까지 이만큼 가까워지면 멈춘다(제자리 떨림 방지) */
const ARRIVE_PX = 6;
const STAND_SIZE = 76;
const SIT_SIZE = 64;
/** 스프라이트 이미지 높이 중 발바닥 위치 비율 (서기·걷기·때리기·기절·긁기 1000/1024, 앉기 972/1024) */
const STAND_FOOT = 1000 / 1024;
const SIT_FOOT = 972 / 1024;
/** 발 기준 충돌 상자 */
const HIT = { halfWidth: 12, up: 8, down: 4 };
const CHUNK = 16;
/** 오두막 문 앞 이 거리 안에 들어오면 입장 준비 */
const DOOR_RADIUS = TILE * 0.9;
const ENTER_CHARGE_MS = 900;
/** 통나무 의자 앞 이 거리 안에서 앉을 수 있다 */
const SEAT_REACH = TILE * 1.4;
const SYNC_MS = 150;
/** 텍스처 한 장이 덮는 월드 크기(px) — 타일의 배수여야 칸마다 이어진다 */
const TEXTURE_SIZE = 192;
const CHARACTER_BASE = "/assets/images/characters/capybara";

const KEY_VECTORS: Partial<Record<string, [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
};
const ATTACK_KEYS: ReadonlySet<string> = new Set(["KeyF", "KeyJ"]);

const TEXTURE_OF: Record<Tile, Texture> = {
  meadow: "meadow",
  grass: "meadow",
  tree: "meadow",
  rock: "meadow",
  fence: "meadow",
  building: "meadow",
  spring: "meadow",
  log: "meadow",
  lantern: "meadow",
  reeds: "meadow",
  mud: "mud",
  water: "water",
  deck: "deck",
};
const GROUND_BY_ID = new Map(GROUND_ASSETS.map((asset) => [asset.id, asset]));

function loadImage(src: string) {
  const image = new Image();
  image.src = src;
  return image;
}

const ready = (image: HTMLImageElement | undefined): image is HTMLImageElement =>
  Boolean(image && image.complete && image.naturalWidth > 0);

function loadSession(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

const mod = (value: number, size: number) => ((value % size) + size) % size;

/** 이미지를 가운데·바닥 기준으로 폭에 맞춰 그리고 그린 영역을 돌려준다 */
function drawImageBottom(ctx: CanvasRenderingContext2D, image: HTMLImageElement, centerX: number, bottomY: number, width: number) {
  const height = (width * image.naturalHeight) / image.naturalWidth;
  const left = centerX - width / 2;
  const top = bottomY - height;
  ctx.drawImage(image, left, top, width, height);
  return { left, top, width, height };
}

/** 청크 바닥을 텍스처로 굽는다. 종류가 바뀌는 경계에는 데크 테두리·진흙 물가·풀 가장자리를 그려 자연스럽게 잇는다 */
function drawChunk(
  chunk: Chunk,
  cx: number,
  cy: number,
  textures: Map<Texture, HTMLImageElement>,
  tileAt: (tx: number, ty: number) => Tile,
) {
  const canvas = chunk.canvas ?? document.createElement("canvas");
  canvas.width = CHUNK * TILE;
  canvas.height = CHUNK * TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  chunk.tiles.forEach((tile, index) => {
    const tx = cx * CHUNK + (index % CHUNK);
    const ty = cy * CHUNK + Math.floor(index / CHUNK);
    const x = (index % CHUNK) * TILE;
    const y = Math.floor(index / CHUNK) * TILE;
    const kind = TEXTURE_OF[tile];
    const texture = textures.get(kind);
    if (ready(texture)) {
      const scale = texture.naturalWidth / TEXTURE_SIZE;
      ctx.drawImage(
        texture,
        mod(tx * TILE, TEXTURE_SIZE) * scale,
        mod(ty * TILE, TEXTURE_SIZE) * scale,
        TILE * scale,
        TILE * scale,
        x,
        y,
        TILE,
        TILE,
      );
    } else {
      ctx.fillStyle = GROUND_BY_ID.get(kind)?.fallbackColor ?? "#8cbf3f";
      ctx.fillRect(x, y, TILE, TILE);
    }
    if (kind === "meadow") {
      // 같은 풀 텍스처가 반복돼 보이지 않게 짙은 풀 얼룩과 작은 들꽃을 섞는다
      const noise = hash2(3, tx, ty);
      if (noise < 0.14) {
        ctx.fillStyle = noise < 0.07 ? "rgba(50,90,10,0.16)" : "rgba(255,245,160,0.12)";
        ctx.beginPath();
        ctx.ellipse(x + TILE / 2, y + TILE / 2, TILE * (0.5 + noise * 2), TILE * (0.35 + noise), 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (noise > 0.95) {
        ctx.fillStyle = noise > 0.975 ? "#fff6f0" : "#ffd84a";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(x + 10 + hash2(i + 4, tx, ty) * 28, y + 10 + hash2(i + 7, tx, ty) * 28, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const neighbors: [number, number][] = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    for (const [dx, dy] of neighbors) {
      const other = TEXTURE_OF[tileAt(tx + dx, ty + dy)];
      if (other === kind) continue;
      const band = (thick: number) =>
        [dx > 0 ? x + TILE - thick : x, dy > 0 ? y + TILE - thick : y, dx === 0 ? TILE : thick, dy === 0 ? TILE : thick] as const;
      if (kind === "deck") {
        // 데크 가장자리 짙은 테두리목
        ctx.fillStyle = "#6e3f22";
        ctx.fillRect(...band(4));
      } else if (kind === "water") {
        // 물가: 진흙 둑 + 얕은 물 밝은 띠
        ctx.fillStyle = "#8a5634";
        ctx.fillRect(...band(6));
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        const [bx, by, bw, bh] = band(9);
        ctx.fillRect(dx > 0 ? bx : dx < 0 ? bx + 6 : bx, dy > 0 ? by : dy < 0 ? by + 6 : by, dx === 0 ? bw : 3, dy === 0 ? bh : 3);
      } else if (kind === "mud" && other === "meadow") {
        ctx.fillStyle = "rgba(70,110,30,0.28)";
        ctx.fillRect(...band(5));
      }
    }
  });
  return canvas;
}

/** 오두막 + 간판 화면에 켜진 게임 아이콘 하나(펠트 소품: 비행기·스톱워치 등). 게임 표시는 이 아이콘 하나뿐이다 */
function drawBuilding(
  ctx: CanvasRenderingContext2D,
  building: Building,
  image: HTMLImageElement | undefined,
  icon: HTMLImageElement | undefined,
) {
  const asset = BUILDING_ASSETS[building.variant];
  const centerX = (building.tx + BUILDING_WIDTH / 2) * TILE;
  const bottom = building.frontY + TILE * 0.5;
  if (!ready(image)) return;
  const box = drawImageBottom(ctx, image, centerX, bottom, asset.width * TILE);
  if (!ready(icon)) return;

  const screenX = box.left + asset.screen.x * box.width;
  const screenY = box.top + asset.screen.y * box.height;
  const screenW = asset.screen.width * box.width;
  const screenH = asset.screen.height * box.height;
  // 켜진 화면처럼 가운데가 은은하게 밝다
  const glow = ctx.createRadialGradient(screenX + screenW / 2, screenY + screenH / 2, 2, screenX + screenW / 2, screenY + screenH / 2, screenW * 0.6);
  glow.addColorStop(0, "rgba(255,226,150,0.35)");
  glow.addColorStop(1, "rgba(255,226,150,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(screenX, screenY, screenW, screenH);
  // 화면 안에 비율 유지로 꽉 차게(여백 8%)
  const scale = Math.min((screenW * 0.84) / icon.naturalWidth, (screenH * 0.84) / icon.naturalHeight);
  const iconW = icon.naturalWidth * scale;
  const iconH = icon.naturalHeight * scale;
  ctx.drawImage(icon, screenX + (screenW - iconW) / 2, screenY + (screenH - iconH) / 2, iconW, iconH);
}

/** 문 앞 따뜻한 빛. 가까이 가면 밝아지고, 입장 준비 중이면 숨 쉬듯 깜빡인다 */
function drawDoorLight(ctx: CanvasRenderingContext2D, door: Door, now: number, animate: boolean, active: boolean) {
  const pulse = active && animate ? (Math.sin(now / 160) + 1) * 0.12 : 0;
  const light = ctx.createRadialGradient(door.x, door.y, 2, door.x, door.y, TILE * 1.2);
  light.addColorStop(0, `rgba(255,214,120,${(active ? 0.55 : 0.22) + pulse})`);
  light.addColorStop(1, "rgba(255,200,90,0)");
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(door.x, door.y, TILE * 1.2, TILE * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** 온천 위로 모락모락 피어오르는 김 */
function drawSteam(ctx: CanvasRenderingContext2D, x: number, y: number, now: number, animate: boolean) {
  const t = animate ? now / 1000 : 0;
  for (let k = 0; k < 7; k++) {
    const phase = (t * 0.22 + k / 7) % 1;
    const drift = Math.sin(t * 0.8 + k * 1.7) * 14;
    ctx.fillStyle = `rgba(255,255,255,${0.28 * Math.sin(phase * Math.PI)})`;
    ctx.beginPath();
    ctx.arc(x + (k - 3) * 22 + drift, y - phase * TILE * 2.4, 10 + phase * 16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, strong = false) {
  ctx.font = `${strong ? "bold " : ""}13px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(40,28,16,0.85)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x, y);
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffd84a";
  ctx.fill();
  ctx.strokeStyle = "#b8860b";
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * 스프라이트 한 장(left, top, 정사각형 size) 위에 옷을 전부 입힌다.
 * 앉은 정면은 옷장 미리보기와 같은 그림이라 옷장 자리(SLOT_INFO), 나머지 동작은 서 있는 몸 상자 자리(WORLD_ANCHORS)에
 * 바라보는 방향의 옷 그림(앞·뒤·옆)을 쓴다. 왼쪽을 보면 오른쪽 옆모습 자리와 그림을 좌우 반전한다. 그 방향 그림이 없는 옷은 건너뛴다
 */
function drawOutfit(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  outfit: Outfit,
  view: Direction | "sit-down",
  left: number,
  top: number,
  size: number,
  outfitImage: (src: string) => HTMLImageElement,
) {
  const sitting = view === "sit-down";
  const wardrobeView = sitting ? "front" : VIEW_OF[view];
  const flip = view === "left";
  const anchorsOf = (slot: WardrobeSlot) => (sitting ? SLOT_INFO[slot].anchors : (WORLD_ANCHORS[wardrobeView][slot] ?? []));
  const put = (slot: WardrobeSlot, anchor: WardrobeAnchor) => {
    const id = outfit[slot];
    const item = id ? outfitImage(wardrobeSrc(slot, id)) : undefined;
    if (!ready(item)) return;
    const fullWidth = (size * anchor.width) / 100;
    const height = (fullWidth * item.naturalHeight) / item.naturalWidth;
    // 옆모습은 앞모습 옷을 가로로만 좁혀 쓴다
    const width = fullWidth * (anchor.squeeze ?? 1);
    const centerX = left + (size * (flip ? 100 - anchor.x : anchor.x)) / 100;
    const itemTop = top + (size * anchor.bottom) / 100 - height;
    // 짝(신발·장갑) 반전과 왼쪽 보기 반전이 겹치면 원래 방향
    if (anchor.mirror === flip) {
      ctx.drawImage(item, centerX - width / 2, itemTop, width, height);
      return;
    }
    ctx.save();
    ctx.translate(centerX, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(item, -width / 2, itemTop, width, height);
    ctx.restore();
  };
  const layer = (slots: readonly WardrobeSlot[]) => {
    for (const slot of slots) for (const anchor of anchorsOf(slot)) put(slot, anchor);
  };
  layer(BODY_LAYERS);
  if (BODY_LAYERS.some((slot) => outfit[slot])) {
    // 머리를 한 번 더 그려 옷이 턱 밑으로 들어가 보이게 한다 (옷장 미리보기와 같은 방식)
    const head = sitting ? HEAD_ELLIPSE : WORLD_HEAD_ELLIPSE[wardrobeView];
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      left + (size * (flip ? 100 - head.x : head.x)) / 100,
      top + (size * head.y) / 100,
      (size * head.rx) / 100,
      (size * head.ry) / 100,
      0,
      0,
      Math.PI * 2,
    );
    ctx.clip();
    ctx.drawImage(base, left, top, size, size);
    ctx.restore();
  }
  layer(OVER_HEAD_LAYERS);
}

function drawCapybara(
  ctx: CanvasRenderingContext2D,
  sprites: Map<SpriteKey, HTMLImageElement>,
  x: number,
  y: number,
  facing: Facing,
  look: CapybaraLook,
  outfit: Outfit,
  outfitImage: (src: string) => HTMLImageElement,
  now: number,
  animate: boolean,
) {
  if (!look.sitting) {
    ctx.fillStyle = "rgba(30,40,10,0.25)";
    ctx.beginPath();
    ctx.ellipse(x, y, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (look.stunned) {
    const image = sprites.get("stun");
    if (ready(image)) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(animate ? Math.sin(now / 90) * 0.07 : 0); // 비틀비틀
      ctx.drawImage(image, -STAND_SIZE / 2, -STAND_SIZE * STAND_FOOT, STAND_SIZE, STAND_SIZE);
      drawOutfit(ctx, image, outfit, "down", -STAND_SIZE / 2, -STAND_SIZE * STAND_FOOT, STAND_SIZE, outfitImage);
      ctx.restore();
    }
    for (let i = 0; i < 3; i++) {
      const angle = (animate ? now / 240 : 0) + (i * Math.PI * 2) / 3;
      drawStar(ctx, x + Math.cos(angle) * 20, y - STAND_SIZE * 0.95 + Math.sin(angle) * 6, 6);
    }
    return;
  }

  // 앉기·때리기 스프라이트는 상하좌우 4장뿐이라 대각선은 가까운 옆모습을 쓴다
  const direction = toDirection(facing);
  const [fx, fy] = FACING_VECTORS[facing];
  // 주먹: 앞으로 빠르게 뻗었다가(0~35%) 천천히 거둬들인다
  const lunge = look.attack < 0 ? 0 : (look.attack < 0.35 ? look.attack / 0.35 : 1 - (look.attack - 0.35) / 0.65) * 8;
  const walkKey: SpriteKey = `${look.pose}-${facing}`;
  const idleKey = look.idle ? idleKeys(look.idle, direction).find((candidate) => ready(sprites.get(candidate))) : undefined;
  const key: SpriteKey =
    look.attack >= 0
      ? `punch-${direction}`
      : look.sitting
        ? `sit-${direction}`
        : idleKey
          ? idleKey
          : ready(sprites.get(walkKey))
            ? walkKey
            : `${look.pose}-${direction}`; // 대각선 걷기 이미지가 아직 없으면 옆모습
  const image = sprites.get(key);
  if (!ready(image)) return;
  const size = look.sitting ? SIT_SIZE : STAND_SIZE;
  const foot = look.sitting ? SIT_FOOT : STAND_FOOT;
  // 긁기는 뒷모습, 하품·졸기는 그 스프라이트의 방향(이미지가 없어 정면으로 대신했으면 정면). 앉은 정면만 옷을 전부 입힌다
  const view =
    look.sitting && direction === "down"
      ? "sit-down"
      : key.startsWith("scratch")
        ? "up"
        : key.startsWith("yawn") || key.startsWith("doze")
          ? (DIRECTIONS.find((side) => key.endsWith(`-${side}`)) ?? "down")
          : direction;
  if (key.startsWith("doze") && animate) {
    // 조는 동안 몸이 천천히 앞뒤로 흔들린다
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(now / 650) * 0.035);
    ctx.drawImage(image, -size / 2, -size * foot, size, size);
    drawOutfit(ctx, image, outfit, view, -size / 2, -size * foot, size, outfitImage);
    ctx.restore();
    return;
  }
  if ((key === "scratch-2" || key === "scratch-3") && animate) {
    // 작게 그리면 앞발 움직임만으론 안 보여서, 긁는 박자에 맞춰 엉덩이를 좌우로 씰룩인다
    const wiggle = key === "scratch-2" ? -1 : 1;
    ctx.save();
    ctx.translate(x + wiggle * 1.5, y);
    ctx.rotate(wiggle * 0.05);
    ctx.drawImage(image, -size / 2, -size * foot, size, size);
    drawOutfit(ctx, image, outfit, view, -size / 2, -size * foot, size, outfitImage);
    ctx.restore();
    return;
  }
  if (look.stride > 0 && animate) {
    // 한 걸음(프레임 2장)마다 몸이 살짝 떴다 내려앉고 좌우로 기울어 뒤뚱뒤뚱 걷는다
    const step = Math.sin((look.stride / (STRIDE_PX * 2)) * Math.PI);
    ctx.save();
    ctx.translate(x, y - Math.abs(step) * 3);
    ctx.rotate(step * 0.045);
    ctx.drawImage(image, -size / 2, -size * foot, size, size);
    drawOutfit(ctx, image, outfit, view, -size / 2, -size * foot, size, outfitImage);
    ctx.restore();
    return;
  }
  ctx.drawImage(image, x + fx * lunge - size / 2, y + fy * lunge - size * foot, size, size);
  drawOutfit(ctx, image, outfit, view, x + fx * lunge - size / 2, y + fy * lunge - size * foot, size, outfitImage);
}

/** 맞은 자리에 터지는 "퍽" 효과. progress 0 → 1 */
function drawHit(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  const cy = y - STAND_SIZE * 0.55;
  const radius = 10 + progress * 22;
  ctx.strokeStyle = `rgba(255,236,120,${1 - progress})`;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * radius * 0.5, cy + Math.sin(angle) * radius * 0.5);
    ctx.lineTo(x + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.stroke();
  }
  ctx.globalAlpha = 1 - progress;
  ctx.font = "900 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#5a1a00";
  ctx.strokeText("퍽!", x, cy - 26 - progress * 10);
  ctx.fillStyle = "#ffcf33";
  ctx.fillText("퍽!", x, cy - 26 - progress * 10);
  ctx.globalAlpha = 1;
}

const walkPose = (walkDist: number) => WALK_CYCLE[Math.floor(walkDist / STRIDE_PX) % WALK_CYCLE.length];
const attackProgress = (attackUntil: number, now: number) => (now < attackUntil ? 1 - (attackUntil - now) / ATTACK_MS : -1);

/** 가만히 있던 시간 → 지금 보여 줄 대기 동작 프레임 (쉬는 구간이면 null) */
/** 대기 동작 프레임 → 그릴 스프라이트 후보. 하품·졸기는 바라보는 방향 것을 먼저, 없으면 정면 것으로 대신한다 */
function idleKeys(frame: IdleFrame, direction: Direction): SpriteKey[] {
  if (frame === "scratch-1" || frame === "scratch-2" || frame === "scratch-3") return [frame];
  return [`${frame}-${direction}`, `${frame}-down`];
}

function idleSprite(idleMs: number): IdleFrame | null {
  let start = 0;
  for (const { action, ms } of IDLE_ACTIONS) {
    const phase = idleMs - start - IDLE_WAIT_MS;
    start += IDLE_WAIT_MS + ms;
    if (phase < 0) return null;
    if (phase >= ms) continue;
    if (action === "scratch") {
      // 손을 대고(1) 위(2)·아래(3)로 번갈아 긁는다
      if (phase < 170) return "scratch-1";
      return Math.floor(phase / 170) % 2 === 0 ? "scratch-2" : "scratch-3";
    }
    // 하품: 입을 벌리기 시작(1) → 크게 하품하며 기지개(2) → 오물오물 개운(3)
    if (action === "yawn") return phase < 450 ? "yawn-1" : phase < 1450 ? "yawn-2" : "yawn-3";
    // 졸기: 꾸벅(1)·더 깊이 꾸벅(2)
    return Math.floor(phase / 700) % 2 === 0 ? "doze-1" : "doze-2";
  }
  return null;
}
/** 대기 동작 한 바퀴가 끝나면 처음부터 다시 */
const nextIdle = (idleMs: number, dt: number) => (idleMs + dt) % IDLE_CYCLE_MS;

const OCTANTS: readonly Facing[] = ["left", "up-left", "up", "up-right", "right", "down-right", "down", "down-left", "left"];
/** 이동 벡터 → 8방향 (45°씩) */
function facingOf(dx: number, dy: number): Facing {
  return OCTANTS[Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 4];
}

export function Lobby({ games }: { games: DoorGame[] }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sitRequest = useRef(false);
  const attackRequest = useRef(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  /** 입은 옷. 게임 루프가 매 프레임 읽어서 그리고 서버에 보낸다 */
  const outfitRef = useRef<Outfit>({});
  const [world] = useState(() => createWorld(LOBBY_SEED, games));
  const [activeDoor, setActiveDoor] = useState<Door | null>(null);
  const [sitting, setSitting] = useState(false);
  const [seatNearby, setSeatNearby] = useState(false);
  const [stunned, setStunned] = useState(false);
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(false);
  // 게임 루프 effect가 router 변경으로 다시 실행되면 캐릭터·멀티 상태가 초기화되므로 이벤트로 감싼다
  const goToGame = useEffectEvent((slug: string) => router.push(`/games/${slug}`));
  const prefetchGame = useEffectEvent((slug: string) => router.prefetch(`/games/${slug}`));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    outfitRef.current = loadOutfit();

    const sprites = new Map<SpriteKey, HTMLImageElement>();
    for (const facing of FACINGS) {
      for (const pose of POSES) sprites.set(`${pose}-${facing}`, loadImage(`${CHARACTER_BASE}/capybara-${pose}-${facing}.webp`));
    }
    for (const direction of DIRECTIONS) {
      sprites.set(`sit-${direction}`, loadImage(`${CHARACTER_BASE}/capybara-idle-${direction}.webp`));
      sprites.set(`punch-${direction}`, loadImage(`${CHARACTER_BASE}/capybara-punch-${direction}.webp`));
    }
    sprites.set("stun", loadImage(`${CHARACTER_BASE}/capybara-stun.webp`));
    for (const n of [1, 2, 3] as const) {
      sprites.set(`scratch-${n}`, loadImage(`${CHARACTER_BASE}/capybara-scratch-${n}.webp`));
    }
    for (const direction of DIRECTIONS) {
      for (const n of [1, 2, 3] as const) sprites.set(`yawn-${n}-${direction}`, loadImage(`${CHARACTER_BASE}/capybara-yawn-${n}-${direction}.webp`));
      for (const n of [1, 2] as const) sprites.set(`doze-${n}-${direction}`, loadImage(`${CHARACTER_BASE}/capybara-doze-${n}-${direction}.webp`));
    }

    // 로비 에셋은 lib/lobby/assets 레지스트리에서 읽는다 (에셋 하나 = 폴더 하나)
    const images = new Map<SpriteId, { asset: SpriteAsset; image: HTMLImageElement }>(
      SPRITE_ASSETS.map((asset) => [asset.id, { asset, image: loadImage(lobbyAssetSrc(asset)) }]),
    );
    const textures = new Map<Texture, HTMLImageElement>(GROUND_ASSETS.map((asset) => [asset.id, loadImage(lobbyAssetSrc(asset))]));
    const buildingImages = BUILDING_ASSETS.map((asset) => loadImage(lobbyAssetSrc(asset)));
    const icons = new Map(world.doors.map((door) => [door.slug, loadImage(`/assets/images/games/${door.slug}/icon.webp`)]));
    // 옷 이미지는 누군가 입고 나타날 때 처음 불러온다
    const outfitImages = new Map<string, HTMLImageElement>();
    const outfitImage = (src: string) => {
      let image = outfitImages.get(src);
      if (!image) {
        image = loadImage(src);
        outfitImages.set(src, image);
      }
      return image;
    };

    // 타일은 청크(16×16) 단위로 한 번만 계산하고, 바닥은 청크마다 캔버스 한 장으로 구워 둔다
    const chunks = new Map<string, Chunk>();
    const chunkAt = (cx: number, cy: number) => {
      const key = `${cx},${cy}`;
      let chunk = chunks.get(key);
      if (!chunk) {
        // ponytail: 오래 돌아다니면 통째로 비운다. 메모리가 문제면 LRU로
        if (chunks.size > 400) chunks.clear();
        const tiles: Tile[] = [];
        for (let y = 0; y < CHUNK; y++) {
          for (let x = 0; x < CHUNK; x++) tiles.push(world.tileAt(cx * CHUNK + x, cy * CHUNK + y));
        }
        chunk = { tiles, canvas: null, textured: false };
        chunks.set(key, chunk);
      }
      return chunk;
    };
    const tileAt = (tx: number, ty: number) => {
      const cx = Math.floor(tx / CHUNK);
      const cy = Math.floor(ty / CHUNK);
      return chunkAt(cx, cy).tiles[(ty - cy * CHUNK) * CHUNK + (tx - cx * CHUNK)];
    };
    const blocked = (x: number, y: number) => {
      const left = Math.floor((x - HIT.halfWidth) / TILE);
      const right = Math.floor((x + HIT.halfWidth) / TILE);
      const top = Math.floor((y - HIT.up) / TILE);
      const bottom = Math.floor((y + HIT.down) / TILE);
      for (let ty = top; ty <= bottom; ty++) {
        for (let tx = left; tx <= right; tx++) if (isBlockingTile(tileAt(tx, ty))) return true;
      }
      return false;
    };

    // 게임에서 돌아오면 들어갔던 오두막 문 앞에서 다시 시작한다
    const positionKey = "lobby-position-v3";
    const me = {
      x: world.spawn.x,
      y: world.spawn.y,
      facing: "up" as Facing,
      pose: "stand" as Pose,
      sitting: false,
      seatIndex: -1,
      walkDist: 0,
      /** 앉기·일어나기 폴짝 애니메이션 시작점 (그림만 옮기고 실제 위치는 바로 바뀐다) */
      hop: { fromX: 0, fromY: 0, start: -Infinity },
      idleMs: 0,
      attackUntil: 0,
      stunUntil: 0,
      lastAttackAt: -Infinity,
      pendingFacing: "up" as Facing,
      facingSince: 0,
    };
    const saved: Partial<{ x: number; y: number }> = JSON.parse(loadSession(positionKey) ?? "{}");
    if (typeof saved.x === "number" && typeof saved.y === "number" && !blocked(saved.x, saved.y)) {
      me.x = saved.x;
      me.y = saved.y;
    }
    const camera = { x: me.x, y: me.y, shakeUntil: 0 };

    const token = loadSession("lobby-token") ?? crypto.randomUUID();
    saveSession("lobby-token", token);

    const remotes = new Map<string, Remote>();
    const hitEffects = new Map<string, number>();

    const nearestDoor = () => world.doors.find((door) => Math.hypot(door.x - me.x, door.y - me.y) < DOOR_RADIUS) ?? null;
    const nearestSeat = () => world.seats.findIndex((seat) => Math.hypot(seat.seatX - me.x, seat.standY - me.y) < SEAT_REACH);
    const seatTaken = (index: number) => {
      const seat = world.seats[index];
      return [...remotes.values()].some((remote) => remote.sitting && Math.hypot(remote.x - seat.seatX, remote.y - seat.seatY) < 16);
    };
    const startHop = () => {
      me.hop = { fromX: me.x, fromY: me.y, start: performance.now() };
    };
    const standUp = () => {
      const seat = world.seats[me.seatIndex];
      if (seat) {
        startHop();
        me.x = seat.seatX;
        me.y = seat.standY;
      }
      me.sitting = false;
      me.seatIndex = -1;
    };

    // 문 앞에서 시작하면(돌아온 직후 등) 한 번 벗어났다 다시 다가가야 입장한다
    let doorArmed = nearestDoor() === null;
    let charge = 0;
    let leaving = false;
    let attackQueued = false;
    let shownDoor: Door | null = null;
    let shownSitting = false;
    let shownSeat = false;
    let shownStunned = false;
    let noticeTimer = 0;

    const showNotice = (text: string) => {
      setNotice(text);
      window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => setNotice(""), 1600);
    };

    const enter = (door: Door) => {
      if (leaving) return;
      leaving = true;
      saveSession(positionKey, JSON.stringify({ x: door.x, y: door.y + TILE * 1.8 }));
      goToGame(door.slug);
    };

    const pressed = new Set<string>();
    // 누른 곳을 월드 좌표로 기억한다 (화면 좌표로 두면 카메라가 따라오면서 목표도 같이 밀려 지나쳐 버린다)
    const pointer = { active: false, x: 0, y: 0 };
    // 터치는 조이스틱: 처음 누른 자리가 중심, 끈 방향으로 걷고 끈 거리만큼 빨라진다
    const stick = { id: -1, originX: 0, originY: 0, dx: 0, dy: 0 };
    const view = { width: 0, height: 0 };

    const renderStick = () => {
      const base = joystickRef.current;
      const knob = knobRef.current;
      if (!base || !knob) return;
      base.hidden = stick.id === -1;
      if (base.hidden) return;
      base.style.transform = `translate(${stick.originX}px, ${stick.originY}px) translate(-50%, -50%)`;
      const length = Math.hypot(stick.dx, stick.dy);
      const k = length > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / length : 1;
      knob.style.transform = `translate(${stick.dx * k}px, ${stick.dy * k}px)`;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      view.width = canvas.clientWidth;
      view.height = canvas.clientHeight;
      canvas.width = Math.round(view.width * dpr);
      canvas.height = Math.round(view.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const onKeyDown = (event: KeyboardEvent) => {
      if (KEY_VECTORS[event.code]) {
        event.preventDefault(); // 방향키 스크롤 방지
        pressed.add(event.code);
        return;
      }
      if (ATTACK_KEYS.has(event.code)) {
        if (!event.repeat) attackRequest.current = true;
        return;
      }
      // 버튼·링크에 포커스가 있으면 Space/Enter는 그 요소의 기본 동작(누르기)에 맡긴다
      if (event.target instanceof HTMLElement && event.target.closest("a, button")) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) sitRequest.current = true;
      } else if (event.code === "Enter") {
        const door = nearestDoor();
        if (door) enter(door);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => pressed.delete(event.code);
    const aimAt = (event: PointerEvent) => {
      pointer.x = camera.x + (event.clientX - view.width / 2);
      pointer.y = camera.y + (event.clientY - view.height / 2);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        pointer.active = true; // 마우스는 누른 곳으로 걸어간다
        aimAt(event);
        return;
      }
      if (stick.id !== -1) return; // 두 번째 손가락은 무시
      stick.id = event.pointerId;
      stick.originX = event.clientX;
      stick.originY = event.clientY;
      stick.dx = 0;
      stick.dy = 0;
      renderStick();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId === stick.id) {
        stick.dx = event.clientX - stick.originX;
        stick.dy = event.clientY - stick.originY;
        renderStick();
        return;
      }
      if (pointer.active) aimAt(event);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId === stick.id) {
        stick.id = -1;
        renderStick();
        return;
      }
      pointer.active = false;
    };
    const onBlur = () => {
      pressed.clear();
      pointer.active = false;
      stick.id = -1;
      renderStick();
    };

    // --- 멀티: 내 상태를 보내고 근처 플레이어를 받는다 ---
    let inFlight = false;
    const sync = () => {
      if (inFlight) return;
      inFlight = true;
      const sent = { x: me.x, y: me.y };
      const attack = attackQueued;
      attackQueued = false;
      fetch("/api/lobby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...sent, facing: me.facing, sitting: me.sitting, attack, outfit: outfitRef.current }),
      })
        .then(async (response) => {
          const data: Partial<PresenceResponse> = await response.json();
          if (!response.ok || !data.you || !Array.isArray(data.players)) throw new Error("sync failed");
          const received = performance.now();

          if (data.you.stunMs > 0) {
            if (me.stunUntil < received) camera.shakeUntil = received + 300;
            me.stunUntil = received + data.you.stunMs;
            if (me.sitting) standUp();
          } else if (Math.hypot(data.you.x - sent.x, data.you.y - sent.y) > 1 && !blocked(data.you.x, data.you.y)) {
            // 서버가 순간이동으로 판단해 위치를 고쳤으면 따른다
            me.x = data.you.x;
            me.y = data.you.y;
          }

          const seen = new Set<string>();
          for (const player of data.players) {
            seen.add(player.id);
            // 남은 시간이 0이면 0으로 둔다 (received를 넣으면 같은 프레임의 rAF 시각보다 커서 잠깐 기절처럼 보인다)
            const stunUntil = player.stunMs > 0 ? received + player.stunMs : 0;
            const remote = remotes.get(player.id);
            if (remote) {
              remote.targetX = player.x;
              remote.targetY = player.y;
              remote.facing = player.facing;
              remote.sitting = player.sitting;
              remote.outfit = player.outfit ?? {};
              remote.stunUntil = stunUntil;
              if (player.attackMs > 0) remote.attackUntil = received + player.attackMs;
            } else {
              remotes.set(player.id, {
                id: player.id,
                x: player.x,
                y: player.y,
                targetX: player.x,
                targetY: player.y,
                facing: player.facing,
                sitting: player.sitting,
                walkDist: 0,
                idleMs: 0,
                stunUntil,
                attackUntil: player.attackMs > 0 ? received + player.attackMs : 0,
                outfit: player.outfit ?? {},
              });
            }
          }
          for (const id of remotes.keys()) if (!seen.has(id)) remotes.delete(id);
          if (data.hit) hitEffects.set(data.hit, received + 450);
          setOffline(false);
        })
        .catch(() => setOffline(true))
        .finally(() => {
          inFlight = false;
        });
    };

    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(now - last, 50); // 탭 전환 후 순간이동 방지
      last = now;
      const isStunned = now < me.stunUntil;

      let dx = 0;
      let dy = 0;
      if (!isStunned) {
        pressed.forEach((code) => {
          const vector = KEY_VECTORS[code];
          if (!vector) return;
          dx += vector[0];
          dy += vector[1];
        });
      }
      let speed = 1;
      if (!isStunned && dx === 0 && dy === 0 && stick.id !== -1) {
        const length = Math.hypot(stick.dx, stick.dy);
        if (length > JOYSTICK_DEADZONE) {
          dx = stick.dx;
          dy = stick.dy;
          speed = Math.max(0.4, Math.min(1, length / JOYSTICK_RADIUS));
        }
      }
      // 방향키·조이스틱이 우선, 안 누르고 있으면 마우스로 누른 곳을 향해 걷는다
      let distance = Infinity;
      if (!isStunned && dx === 0 && dy === 0 && pointer.active) {
        const toX = pointer.x - me.x;
        const toY = pointer.y - me.y;
        const toTarget = Math.hypot(toX, toY);
        if (toTarget > ARRIVE_PX) {
          dx = toX;
          dy = toY;
          distance = toTarget;
        }
      }
      const wantsMove = dx !== 0 || dy !== 0;

      if (sitRequest.current) {
        sitRequest.current = false;
        if (isStunned) {
          // 기절 중엔 무시
        } else if (me.sitting) {
          standUp();
        } else {
          const index = nearestSeat();
          if (index >= 0 && !seatTaken(index)) {
            const seat = world.seats[index];
            startHop();
            me.x = seat.seatX;
            me.y = seat.seatY;
            me.facing = "down";
            me.sitting = true;
            me.seatIndex = index;
          } else {
            showNotice(index >= 0 ? "누가 이미 앉아 있어요" : "통나무 의자 앞에서 앉을 수 있어요");
          }
        }
      }
      if (attackRequest.current) {
        attackRequest.current = false;
        if (!isStunned && now - me.lastAttackAt >= ATTACK_COOLDOWN_MS) {
          if (me.sitting) standUp();
          me.attackUntil = now + ATTACK_MS;
          me.lastAttackAt = now;
          attackQueued = true;
        }
      }
      if (wantsMove && me.sitting) standUp(); // 움직이면 일어난다

      const startX = me.x;
      const startY = me.y;
      let moved = false;
      if (wantsMove && !me.sitting) {
        const length = Math.hypot(dx, dy); // 대각선도 같은 속도
        const step = Math.min(WALK_SPEED * speed * (dt / 1000), distance);
        // x·y를 따로 검사해서 벽에 비스듬히 부딪히면 벽을 따라 미끄러진다
        const nextX = me.x + (dx / length) * step;
        if (!blocked(nextX, me.y)) {
          me.x = nextX;
          moved = true;
        }
        const nextY = me.y + (dy / length) * step;
        if (!blocked(me.x, nextY)) {
          me.y = nextY;
          moved = true;
        }
        // 대각선으로 걷다 멈출 때 두 키를 동시에 떼지 못해 마지막 몇 프레임이 상하좌우로 바뀌면 대각선 모습이 사라진다.
        // 방금 전까지 걷던 중이면 새 방향이 잠깐(FACING_HOLD_MS) 유지될 때만 바꾼다
        const next = facingOf(dx, dy);
        if (next === me.facing || me.walkDist === 0) {
          me.facing = next;
          me.facingSince = now;
        } else if (me.pendingFacing !== next) {
          me.pendingFacing = next;
          me.facingSince = now;
        } else if (now - me.facingSince >= FACING_HOLD_MS) {
          me.facing = next;
        }
      }
      me.walkDist = moved ? me.walkDist + Math.hypot(me.x - startX, me.y - startY) : 0;
      me.pose = moved ? walkPose(me.walkDist) : "stand";
      const attacking = now < me.attackUntil;
      me.idleMs = moved || wantsMove || me.sitting || isStunned || attacking ? 0 : nextIdle(me.idleMs, dt);

      const follow = reducedMotion ? 1 : Math.min(1, dt / 120);
      camera.x += (me.x - camera.x) * follow;
      camera.y += (me.y - camera.y) * follow;

      const door = nearestDoor();
      if (!door) doorArmed = true;
      charge = door && doorArmed && !me.sitting && !isStunned ? charge + dt : 0;
      if (door && charge >= ENTER_CHARGE_MS) enter(door);
      if (door !== shownDoor) {
        shownDoor = door;
        setActiveDoor(door);
        if (door) prefetchGame(door.slug);
      }
      if (me.sitting !== shownSitting) setSitting((shownSitting = me.sitting));
      const seatHere = !me.sitting && nearestSeat() >= 0;
      if (seatHere !== shownSeat) setSeatNearby((shownSeat = seatHere));
      if (isStunned !== shownStunned) setStunned((shownStunned = isStunned));

      for (const remote of remotes.values()) {
        const ease = Math.min(1, dt / 100);
        const moving = Math.hypot(remote.targetX - remote.x, remote.targetY - remote.y) > 2;
        const stepX = (remote.targetX - remote.x) * ease;
        const stepY = (remote.targetY - remote.y) * ease;
        remote.x += stepX;
        remote.y += stepY;
        remote.walkDist = moving ? remote.walkDist + Math.hypot(stepX, stepY) : 0;
        const busy = moving || remote.sitting || now < remote.stunUntil || now < remote.attackUntil;
        remote.idleMs = busy ? 0 : nextIdle(remote.idleMs, dt);
      }

      draw(now, door, isStunned, attacking);
      frame = requestAnimationFrame(tick);
    };

    const draw = (now: number, door: Door | null, isStunned: boolean, attacking: boolean) => {
      ctx.fillStyle = "#26301a";
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.save();
      const shake = !reducedMotion && now < camera.shakeUntil ? 4 : 0;
      const originX = Math.round(view.width / 2 - camera.x + (Math.random() - 0.5) * shake * 2);
      const originY = Math.round(view.height / 2 - camera.y + (Math.random() - 0.5) * shake * 2);
      ctx.translate(originX, originY);

      const left = -originX;
      const top = -originY;
      const tx0 = Math.floor(left / TILE) - 1;
      const ty0 = Math.floor(top / TILE) - 1;
      const tx1 = Math.floor((left + view.width) / TILE) + 1;
      const ty1 = Math.floor((top + view.height) / TILE) + 8; // 화면 아래 오두막·나무 윗부분이 올라와 보이도록 여유

      const texturesReady = [...textures.values()].every(ready);
      for (let cy = Math.floor(ty0 / CHUNK); cy <= Math.floor(ty1 / CHUNK); cy++) {
        for (let cx = Math.floor(tx0 / CHUNK); cx <= Math.floor(tx1 / CHUNK); cx++) {
          const chunk = chunkAt(cx, cy);
          if (!chunk.canvas || (texturesReady && !chunk.textured)) {
            chunk.canvas = drawChunk(chunk, cx, cy, textures, tileAt);
            chunk.textured = texturesReady;
          }
          ctx.drawImage(chunk.canvas, cx * CHUNK * TILE, cy * CHUNK * TILE);
        }
      }

      const inView = (x: number, y: number, margin: number) =>
        x > left - margin && x < left + view.width + margin && y > top - margin && y < top + view.height + margin * 3;
      /** 에셋 정의의 폭·바닥 보정대로 그린다. scale은 같은 에셋을 크기만 조금씩 다르게 흩뿌릴 때 */
      const sprite = (id: SpriteId, x: number, bottom: number, scale = 1) => {
        const entry = images.get(id);
        if (entry && ready(entry.image)) {
          drawImageBottom(ctx, entry.image, x, bottom + (entry.asset.offsetY ?? 0), entry.asset.width * TILE * scale);
        }
      };

      // 발 위치(y) 순서로 그려서 오두막·나무·통나무 뒤로 걸어가면 가려진다
      const drawables: { y: number; draw: () => void }[] = [];
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const tile = tileAt(tx, ty);
          const x = (tx + 0.5) * TILE;
          const bottom = (ty + 1) * TILE;
          const noise = hash2(9, tx, ty);
          if (tile === "tree") {
            const kind = noise < 0.55 ? "tree-tropical" : "palm";
            drawables.push({ y: bottom - TILE * 0.2, draw: () => sprite(kind, x, bottom, 0.9 + noise * 0.25) });
          } else if (tile === "fence") {
            drawables.push({ y: bottom, draw: () => sprite("fence", x, bottom) });
          } else if (tile === "rock") {
            drawables.push({ y: bottom, draw: () => sprite("rocks", x, bottom) });
          } else if (tile === "water" && noise < 0.1) {
            // 수련은 물 위에 납작하게 떠 있어서 바닥처럼 먼저 그린다
            sprite("lotus", x, bottom);
          } else if (tile === "grass" && noise < 0.035) {
            const kind = noise < 0.015 ? "banana-bush" : "grass-bush";
            drawables.push({ y: bottom - 8, draw: () => sprite(kind, x, bottom) });
          }
        }
      }
      world.buildings.forEach((building) => {
        const centerX = (building.tx + BUILDING_WIDTH / 2) * TILE;
        if (!inView(centerX, building.frontY, TILE * 8)) return;
        // 정렬 기준은 정면 경계. 그림 아래 테두리 기준이면 오두막 앞에 붙어 선 캐릭터가 가려진다
        drawables.push({
          y: building.frontY,
          draw: () =>
            drawBuilding(ctx, building, buildingImages[building.variant], icons.get(building.slug)),
        });
      });
      // 문 앞 빛은 오두막 그림 아래 테두리 위에 얹히고, 문 앞에 선 캐릭터보다는 먼저 그린다
      for (const item of world.doors) {
        if (!inView(item.x, item.y, TILE * 4)) continue;
        drawables.push({ y: item.y - TILE * 0.45, draw: () => drawDoorLight(ctx, item, now, !reducedMotion, item === door) });
      }
      const { spring } = world;
      if (inView(spring.x, spring.y, TILE * 6)) {
        drawables.push({
          y: spring.y + SPRING_RADIUS * TILE * 0.6,
          draw: () => {
            sprite("onsen", spring.x, spring.y + SPRING_RADIUS * TILE);
            drawSteam(ctx, spring.x, spring.y, now, !reducedMotion);
          },
        });
      }
      for (const seat of world.seats) {
        if (!inView(seat.seatX, seat.seatY, TILE * 3)) continue;
        const bottom = seat.seatY + TILE * 0.38;
        drawables.push({ y: bottom, draw: () => sprite("log-seat", seat.seatX, bottom) });
      }
      for (const prop of world.props) {
        const x = (prop.tx + 0.5) * TILE;
        if (!inView(x, prop.ty * TILE, TILE * 4)) continue;
        const bottom = (prop.ty + 0.9) * TILE;
        drawables.push({ y: bottom, draw: () => sprite(prop.kind, x, bottom) });
      }
      for (const remote of remotes.values()) {
        const look: CapybaraLook = {
          pose: remote.walkDist > 0 ? walkPose(remote.walkDist) : "stand",
          sitting: remote.sitting,
          stunned: now < remote.stunUntil,
          attack: attackProgress(remote.attackUntil, now),
          stride: remote.walkDist,
          idle: idleSprite(remote.idleMs),
        };
        // 통나무에 앉으면 통나무 그림보다 앞에 그린다
        drawables.push({
          y: remote.y + (remote.sitting ? TILE * 0.5 : 0),
          draw: () =>
            drawCapybara(ctx, sprites, remote.x, remote.y, remote.facing, look, remote.outfit, outfitImage, now, !reducedMotion),
        });
      }
      const myLook: CapybaraLook = {
        pose: me.pose,
        sitting: me.sitting,
        stunned: isStunned,
        attack: attacking ? attackProgress(me.attackUntil, now) : -1,
        stride: me.walkDist,
        idle: idleSprite(me.idleMs),
      };
      // 통나무에 앉고 일어날 때 그림만 이전 자리에서 폴짝 뛰어 옮겨 간다
      const hop = reducedMotion ? 1 : Math.min(1, (now - me.hop.start) / HOP_MS);
      const hopEase = 1 - (1 - hop) * (1 - hop);
      const drawnX = me.hop.fromX + (me.x - me.hop.fromX) * hopEase;
      const drawnY = me.hop.fromY + (me.y - me.hop.fromY) * hopEase - Math.sin(hop * Math.PI) * 12;
      drawables.push({
        y: me.y + (me.sitting ? TILE * 0.5 : 0),
        draw: () => drawCapybara(ctx, sprites, drawnX, drawnY, me.facing, myLook, outfitRef.current, outfitImage, now, !reducedMotion),
      });
      drawables.sort((a, b) => a.y - b.y);
      for (const item of drawables) item.draw();

      for (const item of world.doors) {
        if (inView(item.x, item.y, TILE * 4)) drawLabel(ctx, item.title, item.x, item.y + TILE * 0.85, true);
      }
      for (const remote of remotes.values()) {
        drawLabel(ctx, `카피바라 ${remote.id.slice(0, 4)}`, remote.x, remote.y - (remote.sitting ? SIT_SIZE : STAND_SIZE) - 8);
      }
      for (const [id, until] of hitEffects) {
        const target = remotes.get(id);
        const progress = 1 - (until - now) / 450;
        if (!target || progress >= 1) {
          hitEffects.delete(id);
          continue;
        }
        drawHit(ctx, target.x, target.y, Math.max(0, progress));
      }

      if (door && charge > 0) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(me.x, me.y - STAND_SIZE - 14, 10, -Math.PI / 2, -Math.PI / 2 + (charge / ENTER_CHARGE_MS) * Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("blur", onBlur);
    frame = requestAnimationFrame(tick);
    sync();
    const syncId = window.setInterval(sync, SYNC_MS);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onBlur);
      cancelAnimationFrame(frame);
      window.clearInterval(syncId);
      window.clearTimeout(noticeTimer);
    };
  }, [world]);

  const status = stunned ? "기절! 2초 동안 못 움직여요" : notice || (activeDoor ? `${activeDoor.title} 들어가는 중… (Enter로 바로)` : offline ? "혼자 모드 (연결 끊김)" : "");

  return (
    <>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`카피바라 온천 습지 마을 로비. 게임 오두막 ${world.doors.length}채`}
        // touch-none: 누른 채 끌 때 페이지가 스크롤·확대되지 않게
        className="absolute inset-0 size-full touch-none select-none"
      />

      <Wardrobe
        onChange={(outfit) => {
          outfitRef.current = outfit;
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p
          role="status"
          aria-live="polite"
          className="max-w-full rounded-xl bg-card/90 px-4 py-2 text-center text-body-2 font-semibold text-text-strong shadow-sm empty:hidden"
        >
          {status}
        </p>
        <p className="max-w-full text-balance rounded-lg bg-card/80 px-3 py-1.5 text-center text-caption-3 text-text-caption backdrop-blur">
          <span className="[@media(pointer:coarse)]:hidden">
            방향키·WASD 걷기 · F 때리기 · 통나무 앞에서 Space 앉기 · 오두막 문 앞에 가면 입장
          </span>
          <span className="hidden [@media(pointer:coarse)]:inline">화면을 누른 채 끌면 그쪽으로 걸어요 · 오두막 문 앞에 가면 입장</span>
        </p>
      </div>

      {/* 터치 조이스틱: 누른 자리에 나타난다. 위치는 게임 루프가 DOM에 직접 쓴다 */}
      <div ref={joystickRef} hidden aria-hidden="true" className="pointer-events-none fixed left-0 top-0 size-32">
        <NextImage src={`${UI_BASE}/joystick-base.webp`} alt="" width={256} height={256} unoptimized draggable={false} className="absolute inset-0 size-full opacity-90" />
        <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-7 -mt-7 size-14">
          <NextImage src={`${UI_BASE}/joystick-knob.webp`} alt="" width={256} height={256} unoptimized draggable={false} className="size-full drop-shadow-md" />
        </div>
      </div>

      <div className="absolute bottom-[max(5rem,calc(env(safe-area-inset-bottom)+4rem))] right-4 flex flex-col items-center gap-2">
        {(seatNearby || sitting) && (
          <button
            type="button"
            onClick={() => {
              sitRequest.current = true;
            }}
            aria-pressed={sitting}
            aria-label={sitting ? "일어나기" : "통나무에 앉기"}
            className="group flex flex-col items-center gap-0.5 rounded-full focus-visible:outline-2 focus-visible:outline-primary"
          >
            <NextImage
              src={`${UI_BASE}/sit.webp`}
              alt=""
              width={256}
              height={256}
              unoptimized
              draggable={false}
              className={cn(
                "size-18 drop-shadow-md transition-transform duration-100 motion-safe:group-active:scale-90",
                sitting && "brightness-90",
              )}
            />
            <span className="rounded-full bg-card/85 px-2 py-0.5 text-caption-3 font-semibold text-text-strong">{sitting ? "일어나기" : "앉기"}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            attackRequest.current = true;
          }}
          disabled={stunned}
          aria-label="때리기 (F)"
          className="group flex flex-col items-center gap-0.5 rounded-full focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
        >
          <NextImage
            src={`${UI_BASE}/punch.webp`}
            alt=""
            width={256}
            height={256}
            unoptimized
            draggable={false}
            className="size-18 drop-shadow-md transition-transform duration-100 motion-safe:group-active:scale-90"
          />
          <span className="rounded-full bg-card/85 px-2 py-0.5 text-caption-3 font-semibold text-text-strong">때리기</span>
        </button>
      </div>
    </>
  );
}
