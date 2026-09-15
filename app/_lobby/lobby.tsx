"use client";

// 캔버스용 new Image()와 이름이 겹치지 않게 NextImage로 가져온다
import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useEffectEvent, useRef, useState } from "react";

import { pretendard } from "@/config";
import { cn } from "@/lib";
import { Armchair, Bath, Fish, HandFist, NotebookPen } from "lucide-react";
import { API_URL } from "@/lib/api-url";

import { Loading } from "@/components/feedback/loading";

import { flashButton, isShortcutKey } from "./shortcut";

/** 캔버스는 CSS 폰트를 물려받지 않으니 사이트 폰트(Pretendard) 이름을 직접 쓴다 */
const CANVAS_FONT = pretendard.style.fontFamily;

import {
  BUILDING_ASSETS,
  GROUND_ASSETS,
  type GroundId,
  lobbyAssetSrc,
  SPRITE_ASSETS,
  type SpriteAsset,
  type SpriteId,
} from "@/lib/lobby/assets";
import { Input } from "@/components/inputs/input";
import {
  BATH_REACH,
  BATH_SINK,
  YUZU_SINK,
  CORRECTION_SNAP_PX,
  EAT_BITE_MS,
  EAT_MS,
  HEART_LINGER_MS,
  FISH_BITE_MAX_MS,
  FISH_BITE_MIN_MS,
  FISH_AUTO_RECAST_MS,
  FISH_AUTO_REEL_MS,
  FISH_BITE_WINDOW_MS,
  FISH_CAST_MS,
  FISH_CATCHES,
  FISH_LOOKS,
  FISH_REACH,
  FISH_REEL_MS,
  FISH_SHOW_MS,
  MINIMAP_COLORS,
  MINIMAP_REFRESH_MS,
  MINIMAP_TILES,
  NAME_CONFIRM_MS,
  ONSEN_BOTTOM,
  REMOTE_GONE_MS,
  REMOTE_RENDER_DELAY_MS,
} from "@/lib/lobby/constants";
import {
  applyFishEvent,
  type FishCatch,
  fishCatchSrc,
  type FishEvent,
  type FishingLine,
  type FishInventory,
  fishChat,
  loadFishInventory,
  parseFishChat,
  recordCatch,
} from "@/lib/lobby/fishing";
import {
  feedCapybara,
  feedChat,
  loadSatiety,
  type Meal,
  mealDone,
  parseFeedChat,
  type Satiety,
} from "@/lib/lobby/feeding";
import { pushSnapshot, sampleSnapshots, type Snapshot } from "@/lib/lobby/interpolation";
import { loadLobbyProfile, type LobbyProfile, saveLobbyProfile } from "@/lib/lobby/profile";
import { type LobbySettings, playSound, saveLobbySettings, useLobbySettings } from "@/lib/lobby/settings";
import { markLobbyExit } from "@/components/navigation/lobby-link";

import { CAPYBARA_EMOTES, emoteChat, emoteImage, parseEmoteChat } from "@/lib/games/emotes";

import {
  BUBBLE_DEPTH,
  BUBBLE_LINE,
  BUBBLE_TEXT_WIDTH,
  EMOTE_BAKE_SCALE,
  EMOTE_OUTLINE,
  EMOTE_SIZE,
  FISH_BUTTON_SRC,
  FRAME_SRC,
  SITE_LINKS,
  SLEEP_AFTER_MS,
  SLEEP_FRAME_MS,
} from "./constants";
import { EmotePicker } from "./emote-picker";
import { FishBag } from "./fish-bag";
import { GuestbookPanel } from "./guestbook-panel";
import { KeyboardGuide } from "./keyboard-guide";
import { SoundToggle } from "./lobby-settings";
import { ProfileName } from "./profile-name";
import {
  ATTACK_COOLDOWN_MS,
  ATTACK_MS,
  CHAT_COOLDOWN_MS,
  CHAT_MAX,
  CHAT_MS,
  cleanChat,
  graphemes,
  LOBBY_FULL_CODE,
  LOBBY_TICK_MS,
  type LobbyMessage,
  type PresenceRequest,
} from "@/lib/lobby/presence";
import {
  dressSprite,
  loadOutfit,
  type Outfit,
  type OutfitPiece,
  outfitImageSrcs,
  spriteName,
  WARDROBE_SLOTS,
} from "@/lib/lobby/wardrobe";
import { SPRITE_FIT } from "@/lib/lobby/wardrobe-fit";
import {
  BATH_RX,
  BATH_RY,
  type Building,
  BUILDING_WIDTH,
  createWorld,
  DIRECTIONS,
  type Direction,
  type Door,
  type DoorGame,
  ellipseDistance,
  type Facing,
  FACING_VECTORS,
  FACINGS,
  hash2,
  isBlockingTile,
  LOBBY_SEED,
  nearestWater,
  SPRING_RX,
  SPRING_RY,
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
  | `sleep-${1 | 2}`
  | `eat-${1 | 2}`
  | ScratchFrame
  | `${Exclude<IdleFrame, ScratchFrame>}-${Direction}`;
/** 가만히 서 있을 때 돌아가며 하는 동작의 프레임. 긁기는 뒷모습 한 벌, 하품·졸기는 바라보는 방향(상하좌우)마다 따로 있다 */
type ScratchFrame = `scratch-${1 | 2 | 3}`;
type IdleFrame = ScratchFrame | `yawn-${1 | 2 | 3}` | `doze-${1 | 2}`;
type Texture = GroundId;

interface CapybaraLook {
  pose: Pose;
  sitting: boolean;
  /** 통나무에 SLEEP_AFTER_MS 넘게 앉아 있어 잠들었는지 */
  sleeping: boolean;
  stunned: boolean;
  /** 때리기 진행도 0→1. 안 때리면 -1 */
  attack: number;
  /** 걷는 중 누적 거리(px). 걸음마다 몸이 들썩이는 박자에 쓴다. 0이면 서 있음 */
  stride: number;
  /** 대기 동작(긁기·하품·졸기) 프레임. 쉬는 중이 아니면 null */
  idle: IdleFrame | null;
  /** 먹기 시작하고 지난 시간(ms). 안 먹는 중이면 -1 */
  eating: number;
}

interface Remote {
  id: string;
  name: string;
  x: number;
  y: number;
  /** 받은 위치들. 매 프레임 조금 과거(REMOTE_RENDER_DELAY_MS)를 보간해 그린다 (lib/lobby/interpolation.ts) */
  snapshots: Snapshot[];
  /** 마지막으로 응답에 들어 있던 시각 */
  seenAt: number;
  /** 마지막으로 실제로 움직인 시각. 다음 위치를 기다리는 짧은 멈춤에도 걷기 모습을 유지한다 */
  movedAt: number;
  facing: Facing;
  sitting: boolean;
  /**
   * 앉는 걸 처음 본 시각. 서버는 앉은 시각을 안 보내서 내가 본 때부터 센다
   * ponytail: 내가 오기 전부터 앉아 있던 사람은 늦게 잠든 것으로 보인다. 모두에게 똑같이 보여야 하면 서버가 sitMs를 보낼 것
   */
  sitSince: number;
  walkDist: number;
  idleMs: number;
  stunUntil: number;
  attackUntil: number;
  outfit: Outfit;
  chat: string;
  chatUntil: number;
  /** 낚시 중이면 채팅으로 받은 동작(던지기·입질·당기기)으로 채운 줄 */
  fishing: FishingLine | null;
  /** 채팅으로 받은 먹이기. 하트까지 다 떠오르면 비운다 */
  meal: Meal | null;
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
/** 먹는 스프라이트에서 앞발(먹이를 드는 자리)의 발바닥 위 높이 비율 */
const FOOD_Y = 0.42;
/** 발 기준 충돌 상자 */
const HIT = { halfWidth: 12, up: 8, down: 4 };
const CHUNK = 16;
/** 오두막 문 앞 이 거리 안에 들어오면 입장 준비 */
const DOOR_RADIUS = TILE * 0.9;
const ENTER_CHARGE_MS = 900;
/** 통나무 의자 앞 이 거리 안에서 앉을 수 있다 */
const SEAT_REACH = TILE * 1.4;
/** 방명록 게시판 앞 이 거리 안에서 Space로 방명록을 연다 */
const GUESTBOOK_REACH = TILE * 1.5;
/** 로비 WebSocket 주소 (http→ws, https→wss) */
const LOBBY_WS_URL = `${API_URL.replace(/^http/, "ws")}/api/lobby/ws`;
/**
 * 가만히 있으면 이 간격으로만 한 번 보낸다. 서버는 WebSocket이 열려 있으면 조용해도 지우지 않고(연결 확인은 30초 ping),
 * 멈춰 있는 동안 서버에 일을 시키지 않으려고 길게 둔다 — 만일을 위한 안전망일 뿐이다 (전에는 2초)
 */
const HEARTBEAT_MS = 25_000;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 8000;
/** 못 보내고 쌓인 데이터가 이만큼 넘으면(느린 연결) 이번엔 건너뛴다 */
const MAX_BUFFERED_BYTES = 64 * 1024;
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
  guestbook: "meadow",
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

/** 발밑 접지 그림자. 캐릭터·오두막·나무·소품 모두 같은 색으로 깔아야 투명 배경 그림이 바닥에 떠 보이지 않는다 */
function drawGroundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY = radiusX / 3) {
  ctx.fillStyle = "rgba(30,40,10,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
}

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
      // 같은 풀 텍스처가 반복돼 보이지 않게 짙고 옅은 풀 얼룩을 섞는다 (펠트 텍스처와 안 맞는 평면 들꽃 점은 그리지 않는다)
      const noise = hash2(3, tx, ty);
      if (noise < 0.14) {
        ctx.fillStyle = noise < 0.07 ? "rgba(50,90,10,0.16)" : "rgba(255,245,160,0.12)";
        ctx.beginPath();
        ctx.ellipse(x + TILE / 2, y + TILE / 2, TILE * (0.5 + noise * 2), TILE * (0.35 + noise), 0, 0, Math.PI * 2);
        ctx.fill();
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
      /** 경계 쪽이 진하고 안쪽으로 옅어지는 띠. 단색 직선 띠는 펠트 텍스처 위에서 계단처럼 튀어 보인다 */
      const softBand = (thick: number, rgb: string, alpha: number) => {
        const edgeX = dx > 0 ? x + TILE : x;
        const edgeY = dy > 0 ? y + TILE : y;
        const gradient = ctx.createLinearGradient(edgeX, edgeY, edgeX - dx * thick, edgeY - dy * thick);
        gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
        gradient.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(dx > 0 ? x + TILE - thick : x, dy > 0 ? y + TILE - thick : y, dx === 0 ? TILE : thick, dy === 0 ? TILE : thick);
      };
      if (kind === "deck") softBand(10, "110,63,34", 0.5); // 데크 가장자리 그늘
      else if (kind === "water") softBand(14, "138,86,52", 0.55); // 물가 진흙 둑
      else if (kind === "mud" && other === "meadow") softBand(12, "70,110,30", 0.3);
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
  drawGroundShadow(ctx, centerX, bottom - TILE * 0.3, asset.width * TILE * 0.45, TILE * 0.55);
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
    const cx = x + (k - 3) * 36 + drift;
    const cy = y - phase * TILE * 2.4;
    const radius = 16 + phase * 22;
    // 가장자리가 딱 끊기는 원 대신 안에서 밖으로 흩어지는 김
    const puff = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    puff.addColorStop(0, `rgba(255,255,255,${0.3 * Math.sin(phase * Math.PI)})`);
    puff.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = puff;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 머리 꼭대기(x, bottom)에 얹은 펠트 유자 한 알 (온천 그림 속 유자와 같은 그림). 밑면이 털에 묻히게 조금 내린다 */
function drawYuzu(ctx: CanvasRenderingContext2D, image: HTMLImageElement | undefined, x: number, bottom: number) {
  if (ready(image)) drawImageBottom(ctx, image, x, bottom + 3, 16);
}

/**
 * 온천에 몸을 담근 카피바라. 그림을 BATH_SINK만큼 물속으로 내리고 수면(발 위치 y) 아래는 잘라낸 뒤,
 * 잘린 선을 물빛 타원·물결로 덮고 머리에 유자를 얹는다. drawBody는 (x, y)를 발 위치로 캐릭터를 그린다
 */
function drawBathing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: Facing,
  stride: number,
  now: number,
  animate: boolean,
  yuzu: HTMLImageElement | undefined,
  drawBody: (x: number, y: number) => void,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - STAND_SIZE, y - STAND_SIZE * 2, STAND_SIZE * 2, STAND_SIZE * 2);
  ctx.clip();
  drawBody(x, y + BATH_SINK);
  ctx.restore();
  ctx.fillStyle = "rgba(214,232,190,0.7)";
  ctx.beginPath();
  ctx.ellipse(x, y, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  if (animate) for (const offset of [0, 900]) drawRipple(ctx, x, y - 3, ((now + offset) % 1800) / 1800);
  // 바라보는 방향 서기 스프라이트에서 잰 머리 타원 꼭대기. 머리 타원은 귀 끝까지 잡혀 있어서
  // YUZU_SINK만큼 내려 털에 살짝 묻히게 얹고, 물속을 걸을 때 몸이 들썩이는 만큼(drawCapybara와 같은 식) 같이 올린다
  const [headCx, headCy, , headRy] = SPRITE_FIT[`stand-${facing}`].head;
  const headX = x - STAND_SIZE / 2 + (STAND_SIZE * headCx) / 100;
  const headTop = y + BATH_SINK - STAND_SIZE * STAND_FOOT + (STAND_SIZE * (headCy - headRy)) / 100;
  const lift = stride > 0 && animate ? Math.abs(Math.sin((stride / (STRIDE_PX * 2)) * Math.PI)) * 3 : 0;
  drawYuzu(ctx, yuzu, headX, headTop + YUZU_SINK - lift);
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, strong = false) {
  ctx.font = `${strong ? 700 : 600} 13px ${CANVAS_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(40,28,16,0.85)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x, y);
}

/** 둥근 몸통과 꼬리를 끊김 없는 한 선으로 잇는 말풍선 윤곽. 꼬리는 곡선으로 몸통 밑변에서 흘러내린다 */
function bubblePath(ctx: CanvasRenderingContext2D, x: number, bottom: number, left: number, top: number, width: number, height: number, radius: number) {
  const right = left + width;
  const base = top + height;
  const tail = Math.max(2, Math.min(7, x - left - radius, right - radius - x));
  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.arcTo(right, top, right, base, radius);
  ctx.arcTo(right, base, left, base, radius);
  ctx.lineTo(x + tail, base);
  ctx.quadraticCurveTo(x + 1, base + 1, x, bottom);
  ctx.quadraticCurveTo(x - 2, base + 2, x - tail, base);
  ctx.arcTo(left, base, left, top, radius);
  ctx.arcTo(left, top, right, top, radius);
  ctx.closePath();
}

/** 꼬리 끝이 (x, bottom)에 오는 입체 말풍선을 칠하고 몸통 top을 돌려준다. 그림자 + 아래 두께 + 위에서 아래로 옅어지는 음영 */
function fillBubble(ctx: CanvasRenderingContext2D, x: number, bottom: number, width: number, height: number, radius: number) {
  const left = Math.round(x - width / 2);
  const top = Math.round(bottom - BUBBLE_DEPTH - 5 - height);
  const tip = bottom - BUBBLE_DEPTH;
  ctx.save();
  // 두께 판: 몸통을 아래로 밀어 어둡게 칠하고, 바닥 그림자는 이 판에만 준다
  ctx.translate(0, BUBBLE_DEPTH);
  bubblePath(ctx, x, tip, left, top, width, height, radius);
  ctx.shadowColor = "rgba(40,28,16,0.35)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#cbbca6";
  ctx.fill();
  ctx.restore();

  bubblePath(ctx, x, tip, left, top, width, height, radius);
  const shade = ctx.createLinearGradient(0, top, 0, top + height);
  shade.addColorStop(0, "#ffffff");
  shade.addColorStop(0.55, "#fbf8f3");
  shade.addColorStop(1, "#ece3d6");
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(120,92,62,0.22)";
  ctx.stroke();

  // 윗면 광택: 위쪽 가장자리 안쪽에 얇은 흰 띠
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(left + radius / 2, top + 1, width - radius, 1.5);
  ctx.restore();
  return top;
}

/** 카피바라 이모티콘은 말풍선 없이 투명 그림만 띄운다. 배경과 섞이지 않게 그림 테두리에만 옅은 그림자 */
function drawEmote(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, bottom: number) {
  const sticker = emoteSticker(image);
  const size = EMOTE_SIZE + EMOTE_OUTLINE * 2;
  ctx.save();
  ctx.shadowColor = "rgba(40,28,16,0.35)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.drawImage(sticker ?? image, Math.round(x - size / 2), Math.round(bottom - size), size, size);
  ctx.restore();
}

/** 이모티콘마다 흰 스티커 테두리를 입힌 그림을 한 번만 구워 둔다. 매 프레임엔 그 한 장만 그린다 */
const emoteStickers = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

/** 그림을 둘레 16방향으로 조금씩 밀어 찍은 뒤 흰색으로 덮어 윤곽을 부풀리고, 그 위에 원래 그림을 올린다 */
function emoteSticker(image: HTMLImageElement) {
  const cached = emoteStickers.get(image);
  if (cached) return cached;
  const size = EMOTE_SIZE * EMOTE_BAKE_SCALE;
  const border = EMOTE_OUTLINE * EMOTE_BAKE_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = size + border * 2;
  canvas.height = size + border * 2;
  const bake = canvas.getContext("2d");
  if (!bake) return null;
  for (let step = 0; step < 16; step++) {
    const angle = (step / 16) * Math.PI * 2;
    bake.drawImage(image, border + Math.cos(angle) * border, border + Math.sin(angle) * border, size, size);
  }
  bake.globalCompositeOperation = "source-in";
  bake.fillStyle = "#fff";
  bake.fillRect(0, 0, canvas.width, canvas.height);
  bake.globalCompositeOperation = "source-over";
  bake.drawImage(image, border, border, size, size);
  emoteStickers.set(image, canvas);
  return canvas;
}

/** 꼬리 끝이 (x, bottom)에 오는 말풍선. 한글은 띄어쓰기 없이 길게 쓰기도 해서 글자 단위로 줄을 바꾼다 */
function drawBubble(ctx: CanvasRenderingContext2D, text: string, x: number, bottom: number) {
  ctx.font = `500 12px ${CANVAS_FONT}`;
  const lines: string[] = [];
  let line = "";
  for (const char of graphemes(text)) {
    if (line && ctx.measureText(line + char).width > BUBBLE_TEXT_WIDTH) {
      lines.push(line);
      line = char.trimStart();
    } else {
      line += char;
    }
  }
  if (line) lines.push(line);
  const width = Math.round(Math.max(...lines.map((item) => ctx.measureText(item).width)) + 20);
  const height = lines.length * BUBBLE_LINE + 10;
  // 한 줄이면 알약, 여러 줄이면 둥근 카드
  const top = fillBubble(ctx, x, bottom, width, height, Math.min(height / 2, 10));
  ctx.fillStyle = "#1f1a14";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((item, index) => ctx.fillText(item, x, top + 5 + BUBBLE_LINE * (index + 0.5)));
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

interface OutfitDrawer {
  /**
   * 옷 입은 스프라이트를 구워 둔 캔버스. size는 화면에 그릴 크기(CSS px)이고, 캔버스는 size × 기기 픽셀 비율로 딱 맞게 굽는다
   * (서 있으면 76 → 152px, 앉으면 64 → 128px). 입은 옷이 없거나 옷 이미지를 아직 불러오는 중이면 null
   */
  dressed: (base: HTMLImageElement, outfit: Outfit, size: number) => HTMLCanvasElement | null;
}

/**
 * 스프라이트만 그린 캔버스(left, top, 정사각형 size) 위에 옷을 전부 입힌다.
 * 자리는 그 스프라이트(이미지 이름)에서 잰 머리·몸통·눈 기준점에 옷마다 맞춘 상자 (lib/lobby/wardrobe.ts dressSprite).
 * 한벌옷의 채운 그림(clip)은 source-atop으로 스프라이트 윤곽 안에만 그리므로, 다른 그림이 깔린 캔버스에서는 쓰면 안 된다
 */
function drawOutfit(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  outfit: Outfit,
  left: number,
  top: number,
  size: number,
  outfitImage: (src: string) => HTMLImageElement,
) {
  const { under, redraw, over } = dressSprite(spriteName(base.src), outfit);
  const put = (piece: OutfitPiece) => {
    const item = outfitImage(piece.src);
    if (!ready(item)) return;
    const x = left + (size * piece.left) / 100;
    const y = top + (size * piece.top) / 100;
    const width = (size * piece.width) / 100;
    const height = (size * piece.height) / 100;
    if (!piece.mirror) {
      ctx.drawImage(item, x, y, width, height);
      return;
    }
    ctx.save();
    ctx.translate(x + width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(item, 0, y, width, height);
    ctx.restore();
  };
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  under.filter((piece) => piece.clip).forEach(put);
  ctx.restore();
  // 원래 옷 그림은 자르지 않아 후드·꼬리·소매가 몸 밖으로 나온다
  under.filter((piece) => !piece.clip).forEach(put);
  // 발·머리를 한 번 더 그려 한벌옷이 턱 밑으로 들어가고 발은 옷 밖으로 나와 보이게 한다 (옷장 미리보기와 같은 방식)
  for (const [cx, cy, rx, ry] of redraw) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(left + (size * cx) / 100, top + (size * cy) / 100, (size * rx) / 100, (size * ry) / 100, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(base, left, top, size, size);
    ctx.restore();
  }
  over.forEach(put);
}

function drawCapybara(
  ctx: CanvasRenderingContext2D,
  sprites: Map<SpriteKey, HTMLImageElement>,
  x: number,
  y: number,
  facing: Facing,
  look: CapybaraLook,
  outfit: Outfit,
  wardrobe: OutfitDrawer,
  now: number,
  animate: boolean,
) {
  /** 옷 입은 스프라이트 한 장. 구워 둔 캔버스가 있으면 그것을, 안 입었거나 옷 이미지를 불러오는 중이면 스프라이트만 그린다 */
  const drawDressed = (image: HTMLImageElement, left: number, top: number, size: number) => {
    ctx.drawImage(wardrobe.dressed(image, outfit, size) ?? image, left, top, size, size);
  };
  if (!look.sitting) drawGroundShadow(ctx, x, y, 18);

  if (look.stunned) {
    const image = sprites.get("stun");
    if (ready(image)) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(animate ? Math.sin(now / 90) * 0.07 : 0); // 비틀비틀
      drawDressed(image, -STAND_SIZE / 2, -STAND_SIZE * STAND_FOOT, STAND_SIZE);
      ctx.restore();
    }
    for (let i = 0; i < 3; i++) {
      const angle = (animate ? now / 240 : 0) + (i * Math.PI * 2) / 3;
      drawStar(ctx, x + Math.cos(angle) * 20, y - STAND_SIZE * 0.95 + Math.sin(angle) * 6, 6);
    }
    return;
  }

  // 먹을 땐 정면을 보고 한 입마다 입을 벌려 베어 물고(1) 오물오물 씹는다(2)
  const eatImage = sprites.get(look.eating % EAT_BITE_MS < EAT_BITE_MS * 0.3 ? "eat-1" : "eat-2");
  if (look.eating >= 0 && !look.sitting && ready(eatImage)) {
    drawDressed(eatImage, x - STAND_SIZE / 2, y - STAND_SIZE * STAND_FOOT, STAND_SIZE);
    return;
  }

  // 앉기·때리기 스프라이트는 상하좌우 4장뿐이라 대각선은 가까운 옆모습을 쓴다
  const direction = toDirection(facing);
  const [fx, fy] = FACING_VECTORS[facing];
  // 주먹: 앞으로 빠르게 뻗었다가(0~35%) 천천히 거둬들인다
  const lunge = look.attack < 0 ? 0 : (look.attack < 0.35 ? look.attack / 0.35 : 1 - (look.attack - 0.35) / 0.65) * 8;
  const walkKey: SpriteKey = `${look.pose}-${facing}`;
  const idleKey = look.idle ? idleKeys(look.idle, direction).find((candidate) => ready(sprites.get(candidate))) : undefined;
  // 잠든 그림: 새근새근(1) ↔ 콧방울(2)
  const sleepKey: SpriteKey = animate && Math.floor(now / SLEEP_FRAME_MS) % 2 === 1 ? "sleep-2" : "sleep-1";
  const key: SpriteKey =
    look.attack >= 0
      ? `punch-${direction}`
      : look.sitting
        ? look.sleeping && ready(sprites.get(sleepKey))
          ? sleepKey
          : `sit-${direction}`
        : idleKey
          ? idleKey
          : ready(sprites.get(walkKey))
            ? walkKey
            : `${look.pose}-${direction}`; // 대각선 걷기 이미지가 아직 없으면 옆모습
  const image = sprites.get(key);
  if (!ready(image)) return;
  const size = look.sitting ? SIT_SIZE : STAND_SIZE;
  const foot = look.sitting ? SIT_FOOT : STAND_FOOT;
  if (key.startsWith("sleep")) {
    // 자는 동안 숨 쉬듯 몸이 발바닥 기준으로 천천히 부풀었다 가라앉고, 머리 옆으로 z가 떠오른다
    ctx.save();
    ctx.translate(x, y);
    if (animate) ctx.scale(1, 1 + Math.sin(now / 700) * 0.02);
    drawDressed(image, -size / 2, -size * foot, size);
    ctx.restore();
    drawZzz(ctx, x + size * 0.3, y - size * 0.62, now, animate);
    return;
  }
  if (key.startsWith("doze") && animate) {
    // 조는 동안 몸이 천천히 앞뒤로 흔들린다
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(now / 650) * 0.035);
    drawDressed(image, -size / 2, -size * foot, size);
    ctx.restore();
    return;
  }
  if ((key === "scratch-2" || key === "scratch-3") && animate) {
    // 작게 그리면 앞발 움직임만으론 안 보여서, 긁는 박자에 맞춰 엉덩이를 좌우로 씰룩인다
    const wiggle = key === "scratch-2" ? -1 : 1;
    ctx.save();
    ctx.translate(x + wiggle * 1.5, y);
    ctx.rotate(wiggle * 0.05);
    drawDressed(image, -size / 2, -size * foot, size);
    ctx.restore();
    return;
  }
  if (look.stride > 0 && animate) {
    // 한 걸음(프레임 2장)마다 몸이 살짝 떴다 내려앉고 좌우로 기울어 뒤뚱뒤뚱 걷는다
    const step = Math.sin((look.stride / (STRIDE_PX * 2)) * Math.PI);
    ctx.save();
    ctx.translate(x, y - Math.abs(step) * 3);
    ctx.rotate(step * 0.045);
    drawDressed(image, -size / 2, -size * foot, size);
    ctx.restore();
    return;
  }
  drawDressed(image, x + fx * lunge - size / 2, y + fy * lunge - size * foot, size);
}

/** 잠든 카피바라 머리 옆으로 z 세 개가 차례로 떠오르며 커지고 사라진다 */
function drawZzz(ctx: CanvasRenderingContext2D, x: number, y: number, now: number, animate: boolean) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(40,28,16,0.7)";
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 3; i++) {
    const phase = animate ? (now / 2400 + i / 3) % 1 : (i + 1) / 4;
    ctx.globalAlpha = Math.sin(phase * Math.PI);
    ctx.font = `700 ${Math.round(9 + phase * 7)}px ${CANVAS_FONT}`;
    ctx.strokeText("z", x + phase * 10, y - phase * 20);
    ctx.fillText("z", x + phase * 10, y - phase * 20);
  }
  ctx.globalAlpha = 1;
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
  ctx.font = `700 18px ${CANVAS_FONT}`;
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

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
/** 당긴 뒤 끌어올리기(낚았으면 머리 위에 들고 보여 주기까지)가 끝났는지 */
const fishingDone = (line: FishingLine, now: number) => now > line.reelAt + FISH_REEL_MS + (line.catch ? FISH_SHOW_MS : 0);

/** 물 위로 퍼지며 사라지는 물결 고리. progress가 0~1 밖이면 안 그린다 */
function drawRipple(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  if (progress <= 0 || progress >= 1) return;
  ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - progress)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y + 3, 6 + progress * 20, 2.5 + progress * 8, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBobber(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#e5484d";
  ctx.beginPath();
  ctx.arc(x, y - 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x, y - 5, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

/** 낚은 것 펠트 그림 (가방 창과 같은 그림). 처음 그릴 때 한 번만 불러온다 */
const catchImages = new Map<FishCatch, HTMLImageElement>();
const catchImage = (name: FishCatch) => {
  let image = catchImages.get(name);
  if (!image) {
    image = loadImage(fishCatchSrc(name));
    catchImages.set(name, image);
  }
  return image;
};

/** 낚은 것 그림: 펠트 그림(입이 +x 쪽)을 angle만큼 돌려 버둥대게 한다. 그림을 아직 못 받았으면 꼬리·몸통·눈 도형으로 */
function drawCatch(ctx: CanvasRenderingContext2D, name: FishCatch, x: number, y: number, angle: number) {
  const { color, size } = FISH_LOOKS[name];
  const half = size / 2;
  const image = catchImage(name);
  if (ready(image)) {
    const side = size * 1.6; // 그림 칸에 여백이 있어 도형보다 조금 크게
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(image, -side / 2, -side / 2, side, side);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(40,28,16,0.9)";
  ctx.fillStyle = color;
  ctx.beginPath();
  if (name === "낡은 장화") {
    ctx.moveTo(-half * 0.7, -half * 0.9);
    ctx.lineTo(half * 0.8, -half * 0.9);
    ctx.lineTo(half * 0.8, half * 0.1);
    ctx.lineTo(half * 0.2, half * 0.1);
    ctx.lineTo(half * 0.2, half);
    ctx.lineTo(-half * 0.7, half);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.moveTo(-half * 0.7, 0);
    ctx.lineTo(-half * 1.15, -half * 0.45);
    ctx.lineTo(-half * 1.15, half * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, half * 0.8, half * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(half * 0.45, -half * 0.1, Math.max(2, size * 0.08), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1f1a14";
    ctx.beginPath();
    ctx.arc(half * 0.5, -half * 0.1, Math.max(1, size * 0.04), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 먹는 중인 걸음(ms) → 캐릭터 look.eating 값. 다 먹었으면 -1 */
const eatingMs = (meal: Meal | null, now: number) => (meal && now - meal.at < EAT_MS ? Math.max(0, now - meal.at) : -1);

/** 먹는 동안 앞발에 든 먹이. 한 입 베어 물 때마다 작아진다 */
function drawFood(ctx: CanvasRenderingContext2D, name: FishCatch, x: number, y: number, elapsed: number) {
  const bites = Math.ceil(EAT_MS / EAT_BITE_MS);
  const left = 1 - Math.floor(elapsed / EAT_BITE_MS) / bites;
  ctx.save();
  ctx.translate(x, y - STAND_SIZE * FOOD_Y);
  ctx.scale(0.55 * left, 0.55 * left);
  drawCatch(ctx, name, 0, 0, -0.35);
  ctx.restore();
}

/** 한 입마다 머리 위로 하트가 하나씩 떠올라 사라진다. 움직임 줄이기면 하트 하나만 가만히 */
function drawHearts(ctx: CanvasRenderingContext2D, x: number, bottom: number, elapsed: number, motion: boolean) {
  const bites = Math.ceil(EAT_MS / EAT_BITE_MS);
  const life = EAT_BITE_MS + HEART_LINGER_MS;
  for (let i = 0; i < (motion ? bites : 1); i++) {
    const t = motion ? (elapsed - i * EAT_BITE_MS) / life : elapsed / (EAT_MS + HEART_LINGER_MS);
    if (t <= 0 || t >= 1) continue;
    const size = 9;
    ctx.save();
    ctx.globalAlpha = t < 0.15 ? t / 0.15 : Math.min(1, (1 - t) / 0.4);
    ctx.translate(x + (motion ? (i - 1) * 14 + Math.sin(t * Math.PI * 2 + i) * 4 : 0), bottom - size - (motion ? t * 36 : 0));
    ctx.beginPath();
    ctx.moveTo(0, size * 0.55);
    ctx.bezierCurveTo(-size * 1.3, -size * 0.3, -size * 0.55, -size * 1.2, 0, -size * 0.45);
    ctx.bezierCurveTo(size * 0.55, -size * 1.2, size * 1.3, -size * 0.3, 0, size * 0.55);
    ctx.closePath();
    ctx.fillStyle = "#ff6b8b";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(90,20,40,0.85)";
    ctx.stroke();
    ctx.restore();
  }
}

/** 낚은 것 이름을 크게 담은 말풍선 */
function drawCatchName(ctx: CanvasRenderingContext2D, name: FishCatch, x: number, bottom: number) {
  const text = `${name}!`;
  ctx.font = `700 15px ${CANVAS_FONT}`;
  const top = fillBubble(ctx, x, bottom, Math.round(ctx.measureText(text).width + 24), 26, 13);
  ctx.fillStyle = "#1f1a14";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, top + 13);
}

/** 물에 떠 있는 찌와 물결. 캐릭터보다 먼저(바닥 다음에) 그린다 */
function drawFishingWater(ctx: CanvasRenderingContext2D, line: FishingLine, now: number, motion: boolean) {
  const landAt = line.castAt + FISH_CAST_MS;
  if (motion && now < landAt) return; // 아직 날아가는 중
  if (motion) {
    drawRipple(ctx, line.x, line.y, (now - landAt) / 500); // 퐁당
    // 끌어올리는 순간 첨벙
    for (const delay of [0, 160, 320]) drawRipple(ctx, line.x, line.y, (now - line.reelAt - delay) / 600);
  }
  if (now >= line.reelAt) return;
  const biting = now >= line.biteAt;
  if (biting && motion) for (const offset of [0, 350]) drawRipple(ctx, line.x, line.y, ((now - line.biteAt + offset) % 700) / 700);
  const shake = biting && motion ? Math.sin(now / 25) * 1.5 : 0;
  drawBobber(ctx, line.x + shake, line.y + bobOffset(line, now, motion));
}

/** 물 위 찌의 위아래 흔들림. 입질이면 쑥 가라앉는다 */
const bobOffset = (line: FishingLine, now: number, motion: boolean) => (now >= line.biteAt ? 4 : motion ? Math.sin(now / 300) * 1.5 : 0);

/**
 * 낚싯대·줄과 공중의 찌·물고기. 캐릭터·이름표 다음에 그린다. x·y는 그려진 발 위치, labelY는 이름표 높이.
 * 던지기: 뒤로 젖혔다 휘둘러 찌가 포물선으로 날아간다 → 입질: 대가 들썩이며 "!" → 당기기: 물고기가 버둥대다 빙글 돌며 머리 위로 끌려와 이름과 함께 들린다
 */
function drawFishingRod(
  ctx: CanvasRenderingContext2D,
  line: FishingLine,
  x: number,
  y: number,
  facing: Facing,
  now: number,
  motion: boolean,
  labelY: number,
) {
  const [vx, vy] = FACING_VECTORS[facing];
  const reeling = now >= line.reelAt;
  const biting = !reeling && now >= line.biteAt;
  const cast = motion ? clamp01((now - line.castAt) / FISH_CAST_MS) : 1;
  const reel = reeling ? (motion ? clamp01((now - line.reelAt) / FISH_REEL_MS) : 1) : 0;
  // 휘두르기: -1 뒤로 젖힘 · 0 곧게 위 · 1 물 쪽으로 뻗음
  let swing = 1;
  if (reeling) swing = 1 - 1.7 * easeOut(clamp01(reel / 0.45)) + (motion && reel < 0.35 ? Math.sin(now / 30) * 0.12 : 0);
  else if (cast < 0.35) swing = -0.8 * easeOut(cast / 0.35);
  else if (cast < 1) swing = -0.8 + 1.8 * easeOut((cast - 0.35) / 0.65);
  else if (biting && motion) swing = 1.1 + Math.sin(now / 35) * 0.12;
  const handX = x + vx * 14;
  const handY = y - 26 + vy * 6;
  const tipX = handX + vx * 28 * swing;
  const tipY = handY - 24 - (1 - Math.min(1, Math.abs(swing))) * 14 + vy * 10 * swing;

  const holdY = labelY - 30;
  let endX = line.x;
  let endY = line.y + bobOffset(line, now, motion) - 4;
  let sag = biting ? 0 : 12;
  let lineVisible = true;
  let drawItem: (() => void) | null = null;
  if (!reeling && cast < 1) {
    const u = cast < 0.35 ? 0 : (cast - 0.35) / 0.65;
    const bx = lerp(tipX, line.x, u);
    const by = lerp(tipY + 8, line.y, u) - Math.sin(u * Math.PI) * 50;
    endX = bx;
    endY = by - 4;
    sag = 0;
    drawItem = () => drawBobber(ctx, bx, by);
  } else if (reeling && line.catch) {
    const name = line.catch;
    const half = FISH_LOOKS[name].size / 2;
    let fx = x;
    let fy = holdY;
    let angle = -Math.PI / 2;
    if (reel < 0.3) {
      fx = line.x + Math.sin(now / 40) * 3;
      fy = line.y - 4 - Math.abs(Math.sin(now / 90)) * 10;
      angle += Math.sin(now / 50) * 0.8;
    } else if (reel < 1) {
      const u = easeOut((reel - 0.3) / 0.7);
      fx = lerp(line.x, x, u);
      fy = lerp(line.y, holdY, u) - Math.sin(u * Math.PI) * 60;
      angle += u * Math.PI * 2;
    } else if (motion) {
      fx += Math.sin(now / 250) * 3;
      angle += Math.sin(now / 300) * 0.25;
    }
    endX = fx + Math.cos(angle) * half * 0.8;
    endY = fy + Math.sin(angle) * half * 0.8;
    sag = 0;
    drawItem = () => {
      drawCatch(ctx, name, fx, fy, angle);
      if (reel < 1) return;
      const sparkle = (now - line.reelAt - FISH_REEL_MS) / 600;
      if (motion && sparkle < 1) {
        for (let i = 0; i < 4; i++) {
          const around = (i * Math.PI) / 2 + sparkle;
          drawStar(ctx, fx + Math.cos(around) * (half + 8 + sparkle * 10), fy + Math.sin(around) * (half + 8 + sparkle * 10), 5 * (1 - sparkle));
        }
      }
      drawCatchName(ctx, name, x, fy - half - 6);
    };
  } else if (reeling) {
    // 놓쳤으면 빈 찌가 낚싯대 끝으로 감겨 온다
    const u = motion ? clamp01(reel / 0.6) : 1;
    lineVisible = u < 1;
    const bx = lerp(line.x, tipX, easeOut(u));
    const by = lerp(line.y, tipY + 8, easeOut(u)) - Math.sin(u * Math.PI) * 30;
    endX = bx;
    endY = by - 4;
    sag = 0;
    if (lineVisible) drawItem = () => drawBobber(ctx, bx, by);
  }

  ctx.lineCap = "round";
  ctx.strokeStyle = "#7a4a22";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  if (lineVisible) {
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo((tipX + endX) / 2, Math.max(tipY, endY) + sag, endX, endY);
    ctx.stroke();
  }
  drawItem?.();
  if (biting) drawBubble(ctx, "!", x, labelY - 10);
}

const OCTANTS: readonly Facing[] = ["left", "up-left", "up", "up-right", "right", "down-right", "down", "down-left", "left"];
/** 이동 벡터 → 8방향 (45°씩) */
function facingOf(dx: number, dy: number): Facing {
  return OCTANTS[Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 4];
}

export function Lobby({ games }: { games: DoorGame[] }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Space(앉기·목욕·낚시 버튼): 통나무 앞이면 앉기·일어나기, 온천 둘레면 목욕·나오기, 물가면 계속 낚기 시작·그만하기 */
  const spaceRequest = useRef(false);
  const attackRequest = useRef(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  /** 입은 옷. 게임 루프가 매 프레임 읽어서 그리고 서버에 보낸다 */
  const outfitRef = useRef<Outfit>({});
  /** 기기별 프로필 id·내가 정한 이름표. 게임 루프가 서버에 보내고, 이름 바꾸기 창이 고친다 */
  const profileRef = useRef<LobbyProfile>({ id: "", name: "" });
  /** 이름 바꾸기 버튼에 보일 지금 이름표 (서버가 받아들인 값) */
  const [myName, setMyName] = useState("");
  /** 보낼 채팅. 게임 루프가 가져가 말풍선을 띄우고 다음 동기화에 실어 보낸다 */
  const chatRequest = useRef<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  /** F·Space로 때리기·앉기를 누르면 버튼에 hover 아이콘을 잠깐 띄우려고 둔다 */
  const attackButtonRef = useRef<HTMLButtonElement>(null);
  const sitButtonRef = useRef<HTMLButtonElement>(null);
  const fishButtonRef = useRef<HTMLButtonElement>(null);
  const bathButtonRef = useRef<HTMLButtonElement>(null);
  const guestbookButtonRef = useRef<HTMLButtonElement>(null);
  const lastChatAt = useRef(-Infinity);
  /** 화면(소리 버튼)은 저장값을 구독하고(다른 탭·게임 화면에서 바꿔도 따라간다), 게임 루프는 ref로 같은 설정을 읽는다 */
  const settings = useLobbySettings();
  const settingsRef = useRef<LobbySettings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  /** 스크린리더용: 캔버스 말풍선은 읽히지 않아서 방금 들은 채팅을 글로도 둔다 */
  const [heardChat, setHeardChat] = useState("");
  const [world] = useState(() => createWorld(LOBBY_SEED, games));
  const [activeDoor, setActiveDoor] = useState<Door | null>(null);
  const [sitting, setSitting] = useState(false);
  const [seatNearby, setSeatNearby] = useState(false);
  const [waterNearby, setWaterNearby] = useState(false);
  /** 방명록 게시판 앞에 서 있음 / 방명록 창이 열려 있음 (게시판 앞에서 Space로 연다) */
  const [guestbookNearby, setGuestbookNearby] = useState(false);
  const [guestbookOpen, setGuestbookOpen] = useState(false);
  const [fishing, setFishing] = useState(false);
  /** 온천: 둘레에 서 있으면 near(목욕 버튼), 물 안이면 in(나오기 버튼) */
  const [bath, setBath] = useState<"near" | "in" | null>(null);
  /** 계속 낚기: 물가에서 Space로 던지면 켜져서 입질마다 알아서 당기고 다시 던진다. Space를 다시 누르거나 걷기·때리기·기절이면 꺼진다. 게임 루프는 ref로 읽는다 */
  const [autoFishing, setAutoFishing] = useState(false);
  const autoFishingRef = useRef(false);
  /** 낚시 가방. 게임 루프가 낚을 때마다 저장하고 새 값을 넣는다 */
  const [fishInventory, setFishInventory] = useState<FishInventory>({});
  /** 카피바라 포만감. 가방에서 먹이를 누르면 feedRequest에 넣고, 게임 루프가 먹이며 새 값을 넣는다 */
  const [satiety, setSatiety] = useState<Satiety>({ value: 0, at: 0 });
  const feedRequest = useRef<FishCatch | null>(null);
  const [stunned, setStunned] = useState(false);
  const [notice, setNotice] = useState("");
  /** 로비 이미지를 받은 비율(%). 100이 되기 전엔 로딩창을 덮고 게임 루프를 돌리지 않는다 */
  const [loadProgress, setLoadProgress] = useState(0);
  // 게임 루프 effect가 router 변경으로 다시 실행되면 캐릭터·멀티 상태가 초기화되므로 이벤트로 감싼다
  const goToGame = useEffectEvent((slug: string) => {
    // 게임 화면의 로비 링크가 새 기록을 쌓지 않고 뒤로 가게 표시해 둔다 (components/navigation/lobby-link)
    markLobbyExit(`/games/${slug}`);
    router.push(`/games/${slug}`);
  });
  const prefetchGame = useEffectEvent((slug: string) => router.prefetch(`/games/${slug}`));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    outfitRef.current = loadOutfit();
    profileRef.current = loadLobbyProfile();
    // 캔버스는 쓰는 굵기의 폰트를 스스로 내려받지 않아서, 안 받아 둔 굵기는 대체 폰트로 그려진다
    for (const weight of [500, 600, 700]) document.fonts.load(`${weight} 13px ${CANVAS_FONT}`, "가A").catch(() => {});
    setFishInventory(loadFishInventory());
    setSatiety(loadSatiety());

    const sprites = new Map<SpriteKey, HTMLImageElement>();
    for (const facing of FACINGS) {
      for (const pose of POSES) sprites.set(`${pose}-${facing}`, loadImage(`${CHARACTER_BASE}/capybara-${pose}-${facing}.webp`));
    }
    for (const direction of DIRECTIONS) {
      sprites.set(`sit-${direction}`, loadImage(`${CHARACTER_BASE}/capybara-idle-${direction}.webp`));
      sprites.set(`punch-${direction}`, loadImage(`${CHARACTER_BASE}/capybara-punch-${direction}.webp`));
    }
    sprites.set("stun", loadImage(`${CHARACTER_BASE}/capybara-stun.webp`));
    for (const n of [1, 2] as const) sprites.set(`sleep-${n}`, loadImage(`${CHARACTER_BASE}/capybara-sleep-${n}.webp`));
    for (const n of [1, 2] as const) sprites.set(`eat-${n}`, loadImage(`${CHARACTER_BASE}/capybara-eating-${n}.webp`));
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
    /** 머리 위 말풍선. 카피바라 이모티콘이면 그림으로, 그림이 아직 안 받아졌으면 그 이모티콘 글로 */
    const drawSpeech = (text: string, x: number, bottom: number) => {
      const emote = parseEmoteChat(text);
      if (emote === null) return drawBubble(ctx, text, x, bottom);
      const image = outfitImage(emoteImage(emote));
      if (ready(image)) drawEmote(ctx, image, x, bottom);
      else drawBubble(ctx, CAPYBARA_EMOTES[emote], x, bottom);
    };
    // 옷 입은 스프라이트는 (스프라이트·방향·옷 조합)마다 한 번만 캔버스에 구워 두고, 매 프레임엔 그 한 장만 그린다
    const dressedCache = new Map<string, HTMLCanvasElement>();
    /** 캔버스의 기기 픽셀 비율 (resize에서 갱신). 옷 입은 스프라이트를 화면 크기에 딱 맞게 굽는 데 쓴다 */
    let pixelRatio = 1;
    const wardrobe: OutfitDrawer = {
      dressed: (base, outfit, size) => {
        const worn = WARDROBE_SLOTS.flatMap((slot) => {
          const id = outfit[slot];
          return id ? [`${slot}:${id}`] : [];
        });
        if (worn.length === 0) return null;
        // 그릴 크기 그대로 구워서 매 프레임 확대·축소 없이 1:1로 찍는다 (크기가 키에 들어가 화면 배율이 바뀌면 새로 굽는다)
        const px = Math.ceil(size * pixelRatio);
        const key = `${base.src}|${px}|${worn.join(",")}`;
        const cached = dressedCache.get(key);
        if (cached) return cached;
        // 옷 이미지를 다 불러온 뒤에만 굽는다 (덜 불러온 채 구우면 빠진 옷이 그대로 굳는다)
        const { under, over } = dressSprite(spriteName(base.src), outfit);
        if (![...under, ...over].every((piece) => ready(outfitImage(piece.src)))) return null;
        const canvas = document.createElement("canvas");
        canvas.width = px;
        canvas.height = px;
        const bake = canvas.getContext("2d");
        if (!bake) return null;
        bake.drawImage(base, 0, 0, px, px);
        drawOutfit(bake, base, outfit, 0, 0, px, outfitImage);
        // ponytail: 넘치면 통째로 비운다 (청크 캐시와 같은 방식). 사람이 많아 자주 비워지면 LRU로
        if (dressedCache.size > 300) dressedCache.clear();
        dressedCache.set(key, canvas);
        return canvas;
      },
    };

    // 타일은 청크(16×16) 단위로 한 번만 계산하고, 바닥은 청크마다 캔버스 한 장으로 구워 둔다
    const chunks = new Map<number, Chunk>();
    const chunkAt = (cx: number, cy: number) => {
      // 매 프레임 보이는 타일마다(1080p 약 1,400번) 불린다 — 문자열 키를 만들지 않고 숫자 키로 찾는다.
      // ponytail: cy가 ±50,000청크(80만 타일) 안일 때만 겹치지 않는다. 세계가 그보다 넓어지면 키를 바꿀 것
      const key = cx * 100_003 + cy;
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

    const { spring } = world;
    /** 발 위치가 온천 물 안(목욕 중)인지. 목욕 상태를 따로 보내지 않고 위치로 판단해서 남의 카피바라도 똑같이 그린다 */
    const inBath = (x: number, y: number) => ellipseDistance(x - spring.x, y - spring.y, BATH_RX + 0.3, BATH_RY + 0.3) <= 1;
    const nearSpring = () =>
      ellipseDistance(me.x - spring.x, me.y - spring.y, SPRING_RX + BATH_REACH, SPRING_RY + BATH_REACH) <= 1;

    // 게임에서 돌아오면 들어갔던 오두막 문 앞에서 다시 시작한다
    const positionKey = "lobby-position-v3";
    const me = {
      x: world.spawn.x,
      y: world.spawn.y,
      facing: "up" as Facing,
      pose: "stand" as Pose,
      sitting: false,
      seatIndex: -1,
      /** 앉은 시각. SLEEP_AFTER_MS가 지나면 잠든다 */
      sitSince: 0,
      walkDist: 0,
      /** 앉기·일어나기 폴짝 애니메이션 시작점 (그림만 옮기고 실제 위치는 바로 바뀐다) */
      hop: { fromX: 0, fromY: 0, start: -Infinity },
      idleMs: 0,
      attackUntil: 0,
      stunUntil: 0,
      lastAttackAt: -Infinity,
      pendingFacing: "up" as Facing,
      facingSince: 0,
      chat: "",
      chatUntil: 0,
      /** 낚시 중이면 찌 위치(물 타일 가운데, px)와 던지기·입질·당기기 시각. 다른 사람에겐 채팅으로 알린다 */
      fishing: null as FishingLine | null,
      /** 가방에서 먹인 것과 먹기 시작한 시각. 하트까지 다 떠오르면 비운다 */
      meal: null as Meal | null,
      /** 서버가 정해 준 이름표. 첫 동기화 전엔 비어 있다 */
      name: "",
    };
    const saved: Partial<{ x: number; y: number }> = JSON.parse(loadSession(positionKey) ?? "{}");
    if (typeof saved.x === "number" && typeof saved.y === "number" && !blocked(saved.x, saved.y)) {
      me.x = saved.x;
      me.y = saved.y;
    }
    const camera = { x: me.x, y: me.y, shakeUntil: 0 };

    // 탭마다 새로 만든다. sessionStorage에 두면 탭 복제 때 같은 토큰이 복사돼 두 탭 위치가 번갈아 들어가 서로 끌어당긴다
    // (게임에 들어가면 연결이 닫혀 서버가 플레이어를 바로 지우므로, 토큰을 이어 써도 이름표가 유지되지 않았다)
    const token = crypto.randomUUID();

    const remotes = new Map<string, Remote>();
    const hitEffects = new Map<string, number>();

    const nearestDoor = () => world.doors.find((door) => Math.hypot(door.x - me.x, door.y - me.y) < DOOR_RADIUS) ?? null;
    const nearestSeat = () => world.seats.findIndex((seat) => Math.hypot(seat.seatX - me.x, seat.standY - me.y) < SEAT_REACH);
    const nearGuestbook = () => Math.hypot(world.guestbook.x - me.x, world.guestbook.y - me.y) < GUESTBOOK_REACH;
    /** 통나무 두 자리 중 비어 있는 나와 가까운 자리의 x. 둘 다 찼으면 null */
    const freeSpot = (index: number) => {
      const seat = world.seats[index];
      const free = seat.spots.filter(
        (spotX) => ![...remotes.values()].some((remote) => remote.sitting && Math.hypot(remote.x - spotX, remote.y - seat.seatY) < 16),
      );
      return free.sort((a, b) => Math.abs(a - me.x) - Math.abs(b - me.x))[0] ?? null;
    };
    const startHop = () => {
      me.hop = { fromX: me.x, fromY: me.y, start: performance.now() };
    };
    const standUp = () => {
      const seat = world.seats[me.seatIndex];
      if (seat) {
        // 앉았던 자리 바로 앞으로 내려선다
        startHop();
        me.y = seat.standY;
      }
      me.sitting = false;
      me.seatIndex = -1;
    };
    /** 선 자리에서 온천 가운데 쪽으로 폴짝 뛰어들어 물 안쪽 가장자리에 담근다 */
    const enterBath = () => {
      const angle = Math.atan2((me.y - spring.y) / BATH_RY, (me.x - spring.x) / BATH_RX);
      startHop();
      me.x = spring.x + Math.cos(angle) * BATH_RX * TILE * 0.8;
      me.y = spring.y + Math.sin(angle) * BATH_RY * TILE * 0.8;
      me.facing = "down";
      playSound("bathIn", settingsRef.current);
      showNotice("아~ 따끈따끈해요 · Space로 나오기");
    };
    /** 가까운 둘레부터 좌우로 번갈아 돌아보며 발 디딜 풀밭으로 폴짝 나온다 (등불·데크 갈래길에 막히면 옆자리) */
    const leaveBath = () => {
      const angle = Math.atan2((me.y - spring.y) / SPRING_RY, (me.x - spring.x) / SPRING_RX);
      for (let i = 0; i < 16; i++) {
        const turn = angle + (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 8);
        for (const extra of [0.6, 1.2]) {
          const x = spring.x + Math.cos(turn) * (SPRING_RX + extra) * TILE;
          const y = spring.y + Math.sin(turn) * (SPRING_RY + extra) * TILE;
          if (blocked(x, y)) continue;
          startHop();
          me.x = x;
          me.y = y;
          playSound("bathOut", settingsRef.current);
          return;
        }
      }
    };

    // 문 앞에서 시작하면(돌아온 직후 등) 한 번 벗어났다 다시 다가가야 입장한다
    let doorArmed = nearestDoor() === null;
    let charge = 0;
    let leaving = false;
    let attackQueued = false;
    let chatQueued: string | null = null;
    let shownDoor: Door | null = null;
    let shownSitting = false;
    let shownSeat = false;
    let shownBath: typeof bath = null;
    let shownWater = false;
    let shownGuestbook = false;
    let shownFishing = false;
    let shownStunned = false;
    // 내 캐릭터 동작 프레임이 바뀌는 순간에만 효과음을 내려고 지난 프레임을 기억한다
    let soundPose: Pose = "stand";
    let soundIdle: IdleFrame | null = null;
    let noticeTimer = 0;

    const showNotice = (text: string, ms = 1600) => {
      setNotice(text);
      window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => setNotice(""), ms);
    };

    // --- 낚시 ---
    let biteAnnounced = false;
    let autoCastAt = 0;
    /** 다음 동기화에 채팅으로 실어 보낼 낚시 동작 (fishChat). 못 보낸 게 있으면 새 동작이 덮어쓴다 */
    let fishQueued: string | null = null;
    let fishSeq = 0;
    const queueFish = (event: FishEvent) => {
      fishSeq += 1;
      fishQueued = fishChat(fishSeq, event);
    };
    const castLine = (water: { x: number; y: number }, now: number) => {
      const wait = FISH_BITE_MIN_MS + Math.random() * (FISH_BITE_MAX_MS - FISH_BITE_MIN_MS);
      me.fishing = { x: water.x, y: water.y, castAt: now, biteAt: now + FISH_CAST_MS + wait, reelAt: Infinity, catch: null };
      biteAnnounced = false;
      me.facing = facingOf(water.x - me.x, water.y - me.y);
      queueFish({ kind: "cast", x: water.x, y: water.y });
      playSound("fishCast", settingsRef.current);
    };
    /** 당기기. caught면 무작위 하나를 낚아 가방에 넣고, 아니면 빈 찌를 감아 온다. 이미 당겼으면 무시 */
    const reelLine = (now: number, caught: boolean) => {
      const line = me.fishing;
      if (!line || line.reelAt !== Infinity) return;
      const name = caught ? FISH_CATCHES[Math.floor(Math.random() * FISH_CATCHES.length)] : null;
      line.reelAt = now;
      line.catch = name;
      queueFish({ kind: "reel", catch: name });
      if (!name) return;
      showNotice(`${name} 낚았어요!`);
      setFishInventory(recordCatch(name));
      playSound("fishCatch", settingsRef.current);
    };
    const stopAuto = () => {
      if (!autoFishingRef.current) return;
      autoFishingRef.current = false;
      setAutoFishing(false);
    };

    // --- 먹이 주기 ---
    /** 다음 동기화에 채팅으로 실어 보낼 먹이기 (feedChat). 낚시 동작이 먼저 나간다 */
    let feedQueued: string | null = null;
    let feedSeq = 0;
    /** 마지막으로 쩝 소리를 낸 한 입 번호 */
    let soundBite = -1;
    const feed = (name: FishCatch, now: number, isStunned: boolean) => {
      if (isStunned) return showNotice("기절해서 못 먹어요");
      if (eatingMs(me.meal, now) >= 0) return showNotice("아직 먹는 중이에요");
      const result = feedCapybara(name, Date.now());
      if (!result.ok) {
        const reason = { full: "배불러서 더 못 먹어요", inedible: "그건 못 먹어요, 퉤!", none: "가방에 없어요" };
        return showNotice(reason[result.reason]);
      }
      if (me.sitting) standUp();
      reelLine(now, false);
      stopAuto();
      me.meal = { name, at: now };
      me.facing = "down";
      soundBite = -1;
      feedSeq += 1;
      feedQueued = feedChat(feedSeq, name);
      setFishInventory(result.inventory);
      setSatiety(result.satiety);
      showNotice(`${name} 냠냠! 포만감 ${Math.round(result.satiety.value)}%`);
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
      pixelRatio = dpr;
      view.width = canvas.clientWidth;
      view.height = canvas.clientHeight;
      canvas.width = Math.round(view.width * dpr);
      canvas.height = Math.round(view.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const onKeyDown = (event: KeyboardEvent) => {
      // 채팅·방명록 입력 중엔 WASD·F·Space가 글자로 들어가야 한다
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]")) return;
      // \ 키 조작법 창은 KeyboardGuide가 연다
      if (isShortcutKey(event, "Backslash")) return;
      if (KEY_VECTORS[event.code]) {
        event.preventDefault(); // 방향키 스크롤 방지
        pressed.add(event.code);
        return;
      }
      if (ATTACK_KEYS.has(event.code)) {
        if (!event.repeat) {
          attackRequest.current = true;
          flashButton(attackButtonRef.current);
        }
        return;
      }
      // 버튼·링크에 포커스가 있으면 Space/Enter는 그 요소의 기본 동작(누르기)에 맡긴다
      if (event.target instanceof HTMLElement && event.target.closest("a, button")) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) {
          spaceRequest.current = true;
          flashButton(sitButtonRef.current ?? bathButtonRef.current ?? fishButtonRef.current ?? guestbookButtonRef.current);
        }
      } else if (event.code === "Enter") {
        const door = nearestDoor();
        if (door) {
          enter(door);
        } else {
          event.preventDefault();
          chatInputRef.current?.focus();
        }
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

    // --- 멀티: WebSocket으로 내 상태가 바뀔 때 보내고, 서버가 틱마다 밀어 주는 근처 플레이어를 받는다 ---
    // (HTTP 폴링은 150ms마다 요청을 보내고 응답을 기다려서, 남의 움직임이 최대 두 주기 늦게 보였다)
    // 서버가 꺼져 있으면 연결이 닫히고 1→8초 간격으로 다시 붙는다. 보내지 못한 때리기·채팅은 큐에 남아 다시 붙으면 나간다
    let socket: WebSocket | null = null;
    let disposed = false;
    let reconnectTimer = 0;
    let reconnectDelay = RECONNECT_MIN_MS;
    /** 마지막으로 보낸 위치·방향·앉기·옷. 같으면 HEARTBEAT_MS가 지날 때까지 다시 보내지 않는다 */
    let lastSentKey = "";
    let lastSentAt = -Infinity;
    /** 마지막으로 보낸 내 이름과 그 이름을 처음 보낸 시각. 서버가 거절했는지 NAME_CONFIRM_MS 뒤에 확인한다 */
    let lastSentName = "";
    let nameSentAt = -Infinity;

    const send = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > MAX_BUFFERED_BYTES) return;
      const now = performance.now();
      // 낚시 동작은 채팅 쿨타임이 지난 뒤에 채팅으로 보낸다 (쿨타임 안의 채팅은 서버가 버린다)
      if (chatQueued === null && (fishQueued ?? feedQueued) !== null && now - lastChatAt.current >= CHAT_COOLDOWN_MS + 100) {
        if (fishQueued !== null) {
          chatQueued = fishQueued;
          fishQueued = null;
        } else {
          chatQueued = feedQueued;
          feedQueued = null;
        }
        lastChatAt.current = now;
      }
      const outfit = outfitRef.current;
      const profile = profileRef.current;
      const key = `${me.x},${me.y},${me.facing},${me.sitting},${JSON.stringify(outfit)},${profile.name}`;
      if (!attackQueued && chatQueued === null && key === lastSentKey && now - lastSentAt < HEARTBEAT_MS) return;
      const request: PresenceRequest = {
        token,
        x: me.x,
        y: me.y,
        facing: me.facing,
        sitting: me.sitting,
        attack: attackQueued,
        outfit,
        ...(chatQueued !== null && { chat: chatQueued }),
        // 서버가 받아들인 채팅·이모티콘·낚시를 이 프로필 id로 이력에 남긴다
        ...(profile.id && { profileId: profile.id }),
        ...(profile.name && { name: profile.name }),
      };
      attackQueued = false;
      chatQueued = null;
      lastSentKey = key;
      lastSentAt = now;
      if (profile.name !== lastSentName) {
        lastSentName = profile.name;
        nameSentAt = now;
      }
      socket.send(JSON.stringify(request));
    };

    const receive = (data: Partial<LobbyMessage>) => {
      if (!data.you || !Array.isArray(data.players)) return;
      const received = performance.now();
      if (me.name !== data.you.name) setMyName(data.you.name);
      me.name = data.you.name;

      if (data.you.stunMs > 0) {
        if (me.stunUntil < received) {
          camera.shakeUntil = received + 300;
          playSound("hit", settingsRef.current);
        }
        me.stunUntil = received + data.you.stunMs;
        me.meal = null;
        if (me.sitting) standUp();
        reelLine(received, false);
        stopAuto();
      } else if (
        data.corrected &&
        Math.hypot(data.you.x - me.x, data.you.y - me.y) > CORRECTION_SNAP_PX &&
        (inBath(data.you.x, data.you.y) || !blocked(data.you.x, data.you.y))
      ) {
        // 서버가 순간이동으로 판단해 위치를 크게 고쳤을 때만 따른다 (you는 조금 전에 보낸 위치라 작은 보정까지 따르면 뒤로 튄다.
        // 작은 차이는 다음 전송들로 서버가 곧 따라온다)
        me.x = data.you.x;
        me.y = data.you.y;
      }

      const seen = new Set<string>();
      let heard = "";
      for (const player of data.players) {
        seen.add(player.id);
        // 남은 시간이 0이면 0으로 둔다 (received를 넣으면 같은 프레임의 rAF 시각보다 커서 잠깐 기절처럼 보인다)
        const stunUntil = player.stunMs > 0 ? received + player.stunMs : 0;
        const chatUntil = player.chatMs > 0 ? received + player.chatMs : 0;
        const remote = remotes.get(player.id);
        const newChat = chatUntil > 0 && (!remote || remote.chat !== player.chat || remote.chatUntil < received);
        const fish = newChat ? parseFishChat(player.chat) : null;
        const fed = newChat ? parseFeedChat(player.chat) : null;
        // 먹이기도 채팅을 보낸 시각에 먹기 시작한 것으로 친다
        const meal = fed === null ? null : { name: fed, at: received - (CHAT_MS - player.chatMs) };
        if (newChat && fish === null && fed === null) {
          const emote = parseEmoteChat(player.chat);
          heard = `${player.name}: ${emote === null ? player.chat : `${CAPYBARA_EMOTES[emote]} (이모티콘)`}`;
        }
        // 낚시 동작은 채팅을 보낸 시각에 일어난 것으로 친다 (늦게 들어와도 애니메이션이 제때 끝난다). 멀리 던졌다는 찌는 믿지 않는다
        const nextFishing = (line: FishingLine | null) =>
          fish === null || (fish.kind === "cast" && Math.hypot(fish.x - player.x, fish.y - player.y) > FISH_REACH * 2)
            ? line
            : applyFishEvent(line, fish, received - (CHAT_MS - player.chatMs));
        if (remote) {
          // 받은 위치를 쌓아 두고 틱 루프가 조금 과거를 보간해 그린다 (서버는 바뀐 게 없으면 안 보내므로 평소 간격은 한 틱)
          pushSnapshot(remote.snapshots, player.x, player.y, received, LOBBY_TICK_MS);
          remote.seenAt = received;
          remote.facing = player.facing;
          if (player.sitting && !remote.sitting) remote.sitSince = received;
          remote.sitting = player.sitting;
          remote.outfit = player.outfit ?? {};
          remote.stunUntil = stunUntil;
          remote.chat = player.chat;
          remote.chatUntil = chatUntil;
          remote.fishing = nextFishing(remote.fishing);
          if (meal) remote.meal = meal;
          if (player.attackMs > 0) remote.attackUntil = received + player.attackMs;
        } else {
          remotes.set(player.id, {
            id: player.id,
            name: player.name,
            x: player.x,
            y: player.y,
            snapshots: [{ x: player.x, y: player.y, at: received }],
            seenAt: received,
            movedAt: -Infinity,
            facing: player.facing,
            sitting: player.sitting,
            sitSince: received,
            walkDist: 0,
            idleMs: 0,
            stunUntil,
            attackUntil: player.attackMs > 0 ? received + player.attackMs : 0,
            chat: player.chat,
            chatUntil,
            outfit: player.outfit ?? {},
            fishing: nextFishing(null),
            meal,
          });
        }
      }
      // 한 번 목록에서 빠졌다고 바로 지우면 시야 경계에서 사라졌다 다시 나타나 깜빡인다
      for (const [id, remote] of remotes) if (!seen.has(id) && received - remote.seenAt > REMOTE_GONE_MS) remotes.delete(id);
      if (heard) {
        setHeardChat(heard);
        playSound("chat", settingsRef.current);
      }
      if (data.hit) {
        hitEffects.set(data.hit, received + 450);
        playSound("hit", settingsRef.current);
      }
    };

    const connect = () => {
      if (disposed) return;
      const current = new WebSocket(LOBBY_WS_URL);
      socket = current;
      current.onopen = () => {
        reconnectDelay = RECONNECT_MIN_MS;
        lastSentKey = "";
        send();
      };
      current.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        let data: Partial<LobbyMessage>;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        receive(data);
      };
      // 에러 뒤에는 늘 close가 따라오므로 다시 붙는 건 close에서만 한다
      current.onclose = (event) => {
        if (socket === current) socket = null;
        if (disposed) return;
        // 끊긴 동안 남의 카피바라가 제자리에 멈춘 채 서 있지 않게 치운다
        remotes.clear();
        if (event.code === LOBBY_FULL_CODE) showNotice("로비에 사람이 너무 많아요. 잠시 뒤 다시 들어가 볼게요");
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(RECONNECT_MAX_MS, reconnectDelay * 2);
      };
    };

    // 카톡 등 다른 앱·창으로 나가면 blur 없이 숨기만 하기도 한다(모바일). 누르던 조이스틱·키가 남아 돌아왔을 때 저절로 걸어가지 않게 비우고,
    // 숨어 있는 동안 끊겼으면 재연결 대기(최대 8초)를 기다리지 않고 바로 다시 붙는다
    const onVisibilityChange = () => {
      if (document.hidden) {
        onBlur();
        return;
      }
      if (socket || disposed) return;
      window.clearTimeout(reconnectTimer);
      reconnectDelay = RECONNECT_MIN_MS;
      connect();
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

      if (spaceRequest.current) {
        spaceRequest.current = false;
        const water = me.fishing || me.sitting ? null : nearestWater(tileAt, me.x, me.y, FISH_REACH);
        if (isStunned) {
          // 기절 중엔 무시
        } else if (me.fishing || autoFishingRef.current) {
          // 계속 낚는 중에 Space: 그만 낚는다. 입질이 와 있으면 그 물고기는 낚고 멈춘다 (이미 당겼으면 reelLine이 무시)
          if (me.fishing) reelLine(now, now >= me.fishing.biteAt);
          stopAuto();
        } else if (me.sitting) {
          standUp();
        } else if (inBath(me.x, me.y)) {
          leaveBath();
        } else if (nearestSeat() < 0 && nearSpring()) {
          enterBath();
        } else if (nearGuestbook()) {
          setGuestbookOpen(true);
        } else if (nearestSeat() < 0 && water) {
          // 한 번 던지면 멈출 때까지 입질마다 알아서 당기고 다시 던진다 (아래 게임 루프)
          castLine(water, now);
          autoFishingRef.current = true;
          setAutoFishing(true);
        } else {
          const index = nearestSeat();
          const spotX = index >= 0 ? freeSpot(index) : null;
          if (spotX !== null) {
            startHop();
            me.x = spotX;
            me.y = world.seats[index].seatY;
            me.facing = "down";
            me.sitting = true;
            me.seatIndex = index;
            me.sitSince = now;
            playSound("sit", settingsRef.current);
          } else {
            showNotice(
              index >= 0
                ? "통나무 두 자리가 다 찼어요"
                : "통나무 의자 앞에서 앉고, 온천 앞에서 목욕하고, 물가에서 낚시하고, 게시판 앞에서 방명록을 쓸 수 있어요",
            );
          }
        }
      }
      if (attackRequest.current) {
        attackRequest.current = false;
        if (!isStunned && now - me.lastAttackAt >= ATTACK_COOLDOWN_MS) {
          if (me.sitting) standUp();
          reelLine(now, false);
          stopAuto();
          me.attackUntil = now + ATTACK_MS;
          me.lastAttackAt = now;
          me.meal = null;
          attackQueued = true;
          // 다음 전송 주기를 기다리지 않고 바로 보낸다 — 맞는 사람·구경하는 사람에게 한 주기 늦게 보이지 않게
          send();
          playSound("swing", settingsRef.current);
        }
      }
      // 바꾼 이름을 보냈는데 한참 지나도 이름표가 그대로면 접속 중인 다른 사람이 쓰는 이름이라 서버가 거절한 것이다.
      // 거절된 이름은 지워서 계속 다시 보내지 않는다 (서버는 틱에 바뀐 게 없으면 메시지를 안 보내서 응답 대신 시간으로 판단)
      const wantedName = profileRef.current.name;
      if (wantedName && me.name && me.name !== wantedName && nameSentAt > 0 && now - nameSentAt > NAME_CONFIRM_MS) {
        profileRef.current = { ...profileRef.current, name: "" };
        saveLobbyProfile(profileRef.current);
        showNotice(`“${wantedName}” 이름은 다른 친구가 쓰고 있어요`, 2500);
      }
      if (chatRequest.current !== null) {
        me.chat = chatRequest.current;
        me.chatUntil = now + CHAT_MS;
        chatQueued = chatRequest.current;
        send();
        playSound("chat", settingsRef.current);
        chatRequest.current = null;
      }
      if (feedRequest.current !== null) {
        feed(feedRequest.current, now, isStunned);
        feedRequest.current = null;
      }
      if (wantsMove && me.sitting) standUp(); // 움직이면 일어난다
      if (wantsMove) {
        // 움직이면 낚싯대를 거두고 먹던 걸 멈춘다 (빈 찌를 감아 오는 모습은 남긴다)
        reelLine(now, false);
        stopAuto();
        me.meal = null;
      }
      // 한 입 베어 물 때마다 아삭 쩝
      if (me.meal) {
        const bite = Math.floor((now - me.meal.at) / EAT_BITE_MS);
        if (eatingMs(me.meal, now) >= 0 && bite !== soundBite) {
          soundBite = bite;
          playSound("chomp", settingsRef.current);
        }
        if (mealDone(me.meal, now)) me.meal = null;
      }
      const line = me.fishing;
      if (line && line.reelAt === Infinity && now >= line.biteAt) {
        if (!biteAnnounced) {
          biteAnnounced = true;
          queueFish({ kind: "bite" });
          playSound("fishBite", settingsRef.current);
        }
        if (autoFishingRef.current && now >= line.biteAt + FISH_AUTO_REEL_MS) {
          reelLine(now, true);
        } else if (now > line.biteAt + FISH_BITE_WINDOW_MS) {
          reelLine(now, false);
          showNotice("물고기가 도망갔어요");
        }
      }
      if (me.fishing && fishingDone(me.fishing, now)) {
        me.fishing = null;
        autoCastAt = now + FISH_AUTO_RECAST_MS;
      }
      if (autoFishingRef.current && !me.fishing && !me.sitting && !isStunned && now >= autoCastAt) {
        const water = nearestWater(tileAt, me.x, me.y, FISH_REACH);
        if (water) castLine(water, now);
      }

      const startX = me.x;
      const startY = me.y;
      let moved = false;
      if (wantsMove && !me.sitting) {
        const length = Math.hypot(dx, dy); // 대각선도 같은 속도
        const step = Math.min(WALK_SPEED * speed * (dt / 1000), distance);
        // 목욕 중엔 물 안쪽 타원 밖으로 못 걸어 나가고(나오기는 Space), 뭍에선 막히는 타일에 막힌다
        const bathing = inBath(me.x, me.y);
        const stuck = (x: number, y: number) =>
          bathing ? ellipseDistance(x - spring.x, y - spring.y, BATH_RX, BATH_RY) > 1 : blocked(x, y);
        // x·y를 따로 검사해서 벽에 비스듬히 부딪히면 벽을 따라 미끄러진다
        const nextX = me.x + (dx / length) * step;
        if (!stuck(nextX, me.y)) {
          me.x = nextX;
          moved = true;
        }
        const nextY = me.y + (dy / length) * step;
        if (!stuck(me.x, nextY)) {
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
      const bathingNow = inBath(me.x, me.y);
      // 목욕 중엔 긁기·하품 동작을 쉰다 (물에 잘린 몸으로는 어색하다)
      me.idleMs =
        moved || wantsMove || me.sitting || me.fishing || me.meal || isStunned || attacking || bathingNow ? 0 : nextIdle(me.idleMs, dt);
      // 발을 내딛는 프레임마다 톡, 긁는 박자마다 슥슥, 하품을 시작할 때 하아암
      if (me.pose !== soundPose && me.pose !== "stand") {
        // 발 밑 타일에 따라 풀밭 사각, 나무 데크 통, 진흙 철퍽, 온천 물속 찰박
        const ground = tileAt(Math.floor(me.x / TILE), Math.floor(me.y / TILE));
        playSound(bathingNow ? "stepWater" : ground === "deck" ? "stepDeck" : ground === "mud" ? "stepMud" : "step", settingsRef.current);
      }
      soundPose = me.pose;
      const idleFrame = idleSprite(me.idleMs);
      if (idleFrame !== soundIdle) {
        if (idleFrame === "scratch-2" || idleFrame === "scratch-3") playSound("scratch", settingsRef.current);
        if (idleFrame === "yawn-1") playSound("yawn", settingsRef.current);
        soundIdle = idleFrame;
      }

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
      const bathHere = bathingNow ? "in" : !me.sitting && !seatHere && nearSpring() ? "near" : null;
      if (bathHere !== shownBath) setBath((shownBath = bathHere));
      // 당기고 끌어올리는 중엔 이미 낚시가 끝난 것으로 보여 준다
      const fishingActive = me.fishing !== null && me.fishing.reelAt === Infinity;
      const waterHere =
        !fishingActive && !me.sitting && !seatHere && bathHere === null && nearestWater(tileAt, me.x, me.y, FISH_REACH) !== null;
      if (waterHere !== shownWater) setWaterNearby((shownWater = waterHere));
      const guestbookHere = !me.sitting && !fishingActive && nearGuestbook();
      if (guestbookHere !== shownGuestbook) setGuestbookNearby((shownGuestbook = guestbookHere));
      if (fishingActive !== shownFishing) setFishing((shownFishing = fishingActive));
      if (isStunned !== shownStunned) setStunned((shownStunned = isStunned));

      for (const remote of remotes.values()) {
        const { x: nextX, y: nextY } = sampleSnapshots(remote.snapshots, now - REMOTE_RENDER_DELAY_MS);
        const step = Math.hypot(nextX - remote.x, nextY - remote.y);
        remote.x = nextX;
        remote.y = nextY;
        if (step > 0.05) remote.movedAt = now;
        const moving = now - remote.movedAt < 200;
        remote.walkDist = moving ? remote.walkDist + step : 0;
        if (remote.fishing && fishingDone(remote.fishing, now)) remote.fishing = null;
        if (remote.meal && (moving || mealDone(remote.meal, now))) remote.meal = null;
        const busy =
          moving ||
          remote.sitting ||
          remote.fishing !== null ||
          remote.meal !== null ||
          now < remote.stunUntil ||
          now < remote.attackUntil ||
          inBath(remote.x, remote.y);
        remote.idleMs = busy ? 0 : nextIdle(remote.idleMs, dt);
      }

      draw(now, door, isStunned, attacking);
      if (now - minimapAt >= MINIMAP_REFRESH_MS) {
        minimapAt = now;
        drawMinimap();
      }
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
          const width = entry.asset.width * TILE * scale;
          const base = bottom + (entry.asset.offsetY ?? 0);
          // 물 위에 뜬 수련·납작한 온천은 그림에 이미 바닥이 그려져 있어 그림자를 깔지 않는다
          if (id !== "lotus" && id !== "onsen") drawGroundShadow(ctx, x, base - 3, width * 0.38);
          drawImageBottom(ctx, entry.image, x, base, width);
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
      // 낚시 찌·물결: 물 위에 떠 있어서 수련처럼 바닥 다음에 그린다. 입질이 오면 물결이 퍼지며 쑥 가라앉는다
      if (me.fishing) drawFishingWater(ctx, me.fishing, now, !reducedMotion);
      for (const remote of remotes.values()) {
        if (remote.fishing) drawFishingWater(ctx, remote.fishing, now, !reducedMotion);
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
      if (inView(spring.x, spring.y, TILE * 8)) {
        // 온천은 납작해서 뒤(북쪽) 둘레에 선 캐릭터 말고는 먼저 그린다. 목욕 중인 캐릭터는 물 위에 그려지고,
        // 가운데보다 아래를 기준으로 두면 옆에 선 캐릭터가 둘레 돌 그림에 가려진다
        drawables.push({
          y: spring.y - SPRING_RY * TILE,
          draw: () => {
            sprite("onsen", spring.x, spring.y + ONSEN_BOTTOM * TILE);
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
          sleeping: remote.sitting && now - remote.sitSince >= SLEEP_AFTER_MS,
          stunned: now < remote.stunUntil,
          attack: attackProgress(remote.attackUntil, now),
          stride: remote.walkDist,
          idle: idleSprite(remote.idleMs),
          eating: eatingMs(remote.meal, now),
        };
        const { meal } = remote;
        const remoteBathing = inBath(remote.x, remote.y);
        // 통나무에 앉으면 통나무 그림보다 앞에 그린다
        drawables.push({
          y: remote.y + (remote.sitting ? TILE * 0.5 : 0),
          draw: () => {
            const body = (x: number, y: number) => {
              drawCapybara(ctx, sprites, x, y, remote.facing, look, remote.outfit, wardrobe, now, !reducedMotion);
              if (meal && look.eating >= 0 && !look.sitting) drawFood(ctx, meal.name, x, y, look.eating);
            };
            if (remoteBathing) drawBathing(ctx, remote.x, remote.y, remote.facing, look.stride, now, !reducedMotion, images.get("yuzu")?.image, body);
            else body(remote.x, remote.y);
          },
        });
      }
      const myLook: CapybaraLook = {
        pose: me.pose,
        sitting: me.sitting,
        sleeping: me.sitting && now - me.sitSince >= SLEEP_AFTER_MS,
        stunned: isStunned,
        attack: attacking ? attackProgress(me.attackUntil, now) : -1,
        stride: me.walkDist,
        idle: idleSprite(me.idleMs),
        eating: eatingMs(me.meal, now),
      };
      const myMeal = me.meal;
      // 통나무에 앉고 일어날 때 그림만 이전 자리에서 폴짝 뛰어 옮겨 간다
      const hop = reducedMotion ? 1 : Math.min(1, (now - me.hop.start) / HOP_MS);
      const hopEase = 1 - (1 - hop) * (1 - hop);
      const drawnX = me.hop.fromX + (me.x - me.hop.fromX) * hopEase;
      const drawnY = me.hop.fromY + (me.y - me.hop.fromY) * hopEase - Math.sin(hop * Math.PI) * 12;
      // 폴짝 뛰어드는 그림이 물 안에 닿는 순간부터 몸을 담근다
      const myBathing = inBath(drawnX, drawnY);
      drawables.push({
        y: me.y + (me.sitting ? TILE * 0.5 : 0),
        draw: () => {
          const body = (x: number, y: number) => {
            drawCapybara(ctx, sprites, x, y, me.facing, myLook, outfitRef.current, wardrobe, now, !reducedMotion);
            if (myMeal && myLook.eating >= 0 && !myLook.sitting) drawFood(ctx, myMeal.name, x, y, myLook.eating);
          };
          if (myBathing) drawBathing(ctx, drawnX, drawnY, me.facing, myLook.stride, now, !reducedMotion, images.get("yuzu")?.image, body);
          else body(drawnX, drawnY);
        },
      });
      drawables.sort((a, b) => a.y - b.y);
      for (const item of drawables) item.draw();

      for (const item of world.doors) {
        if (inView(item.x, item.y, TILE * 4)) drawLabel(ctx, item.title, item.x, item.y + TILE * 0.85, true);
      }
      for (const remote of remotes.values()) {
        const labelY = remote.y - (remote.sitting ? SIT_SIZE : STAND_SIZE) - 8 + (inBath(remote.x, remote.y) ? BATH_SINK : 0);
        drawLabel(ctx, remote.name, remote.x, labelY);
        // 낚싯대·공중의 찌와 물고기는 이름표를 가리지 않게 머리 위로 끌어올려 이름표 다음에 그린다
        if (remote.fishing) drawFishingRod(ctx, remote.fishing, remote.x, remote.y, remote.facing, now, !reducedMotion, labelY);
        if (remote.meal) drawHearts(ctx, remote.x, labelY - 8, now - remote.meal.at, !reducedMotion);
        const actionChat = parseFishChat(remote.chat) !== null || parseFeedChat(remote.chat) !== null;
        if (now < remote.chatUntil && !actionChat) drawSpeech(remote.chat, remote.x, labelY - 10);
      }
      const myLabelY = drawnY - (me.sitting ? SIT_SIZE : STAND_SIZE) - 8 + (myBathing ? BATH_SINK : 0);
      if (me.name) drawLabel(ctx, me.name, drawnX, myLabelY);
      const mySpeechY = me.name ? myLabelY - 10 : myLabelY + 4;
      if (me.fishing) drawFishingRod(ctx, me.fishing, drawnX, drawnY, me.facing, now, !reducedMotion, mySpeechY + 10);
      if (now < me.chatUntil) drawSpeech(me.chat, drawnX, mySpeechY);
      if (me.meal) drawHearts(ctx, drawnX, mySpeechY, now - me.meal.at, !reducedMotion);
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

    // 미니맵: 내 둘레 MINIMAP_TILES칸을 타일 하나 = 픽셀 하나로 찍어 키워 그리고, 오두막 문(노랑)·다른 유저(흰색)·나(빨강)를 점으로 얹는다
    const minimap = minimapRef.current;
    const minimapCtx = minimap?.getContext("2d");
    const terrain = document.createElement("canvas");
    terrain.width = MINIMAP_TILES;
    terrain.height = MINIMAP_TILES;
    const terrainCtx = terrain.getContext("2d");
    const terrainPixels = new ImageData(MINIMAP_TILES, MINIMAP_TILES);
    let minimapAt = -Infinity;
    const drawMinimap = () => {
      if (!minimap || !minimapCtx || !terrainCtx) return;
      const size = Math.round(minimap.clientWidth * pixelRatio);
      if (minimap.width !== size) {
        minimap.width = size;
        minimap.height = size;
      }
      const originTx = Math.floor(me.x / TILE) - MINIMAP_TILES / 2;
      const originTy = Math.floor(me.y / TILE) - MINIMAP_TILES / 2;
      const { data } = terrainPixels;
      for (let y = 0; y < MINIMAP_TILES; y++) {
        for (let x = 0; x < MINIMAP_TILES; x++) {
          const [r, g, b] = MINIMAP_COLORS[tileAt(originTx + x, originTy + y)];
          const i = (y * MINIMAP_TILES + x) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }
      terrainCtx.putImageData(terrainPixels, 0, 0);
      minimapCtx.imageSmoothingEnabled = false;
      minimapCtx.drawImage(terrain, 0, 0, size, size);
      const scale = size / MINIMAP_TILES;
      const dot = (x: number, y: number, radius: number, fill: string) => {
        const mx = (x / TILE - originTx) * scale;
        const my = (y / TILE - originTy) * scale;
        if (mx < 0 || my < 0 || mx > size || my > size) return;
        minimapCtx.beginPath();
        minimapCtx.arc(mx, my, radius * pixelRatio, 0, Math.PI * 2);
        minimapCtx.fillStyle = fill;
        minimapCtx.fill();
        minimapCtx.lineWidth = pixelRatio;
        minimapCtx.strokeStyle = "rgba(40,28,16,0.9)";
        minimapCtx.stroke();
      };
      for (const item of world.doors) dot(item.x, item.y, 2.5, "#ffd84a");
      for (const remote of remotes.values()) dot(remote.x, remote.y, 2, "#fff");
      dot(me.x, me.y, 3.5, "#e5484d");
    };

    // 화면에 그릴 이미지(캐릭터·에셋·바닥·건물·오두막 아이콘·내 옷)를 전부 받은 뒤에야 입력·그리기·접속을 시작한다.
    // 못 받은 이미지(404 등)도 끝난 것으로 쳐서 로딩창에 갇히지 않게 한다. 남의 옷·이모티콘은 나타날 때 받는다
    const preload = [
      ...sprites.values(),
      ...[...images.values()].map((entry) => entry.image),
      ...textures.values(),
      ...buildingImages,
      ...icons.values(),
      ...WARDROBE_SLOTS.flatMap((slot) => {
        const id = outfitRef.current[slot];
        // 정면 + 뒤·옆·대각선 그림까지 받아 둬야 방향을 틀 때 옷이 늦게 나타나지 않는다
        return id ? outfitImageSrcs(slot, id).map(outfitImage) : [];
      }),
    ];
    let loadedCount = 0;
    let sendId = 0;
    const start = () => {
      if (disposed) return;
      setLoadProgress(100);
      window.addEventListener("resize", resize);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      canvas.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      window.addEventListener("blur", onBlur);
      document.addEventListener("visibilitychange", onVisibilityChange);
      frame = requestAnimationFrame(tick);
      connect();
      sendId = window.setInterval(send, LOBBY_TICK_MS);
    };
    void Promise.all(
      preload.map((image) =>
        image
          .decode()
          .catch(() => {})
          .then(() => {
            loadedCount++;
            if (!disposed) setLoadProgress(Math.min(99, Math.round((loadedCount / preload.length) * 100)));
          }),
      ),
    ).then(start);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      cancelAnimationFrame(frame);
      window.clearInterval(sendId);
      window.clearTimeout(reconnectTimer);
      window.clearTimeout(noticeTimer);
      disposed = true;
      socket?.close();
    };
  }, [world]);

  const status = stunned
    ? "기절! 2초 동안 못 움직여요"
    : notice ||
      (activeDoor ? `${activeDoor.title} 들어가는 중… (Enter로 바로)` : guestbookNearby && !guestbookOpen ? "Space로 방명록 보기" : "");

  const sendChat = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = chatInputRef.current;
    if (!input) return;
    const text = cleanChat(input.value);
    // 빈 Enter면 입력을 끝내고 다시 걷는다
    if (!text) {
      input.value = "";
      input.blur();
      return;
    }
    // 서버도 쿨타임 안의 채팅을 버리므로, 너무 빠르면 지우지 않고 남겨서 다시 보내게 한다
    const now = performance.now();
    if (now - lastChatAt.current < CHAT_COOLDOWN_MS) return;
    lastChatAt.current = now;
    chatRequest.current = text;
    input.value = "";
  };

  const sendEmote = (id: number) => {
    const now = performance.now();
    if (now - lastChatAt.current < CHAT_COOLDOWN_MS) return;
    lastChatAt.current = now;
    chatRequest.current = emoteChat(id);
  };

  const updateSettings = (next: LobbySettings) => {
    settingsRef.current = next;
    saveLobbySettings(next);
    // 켤 때 짧게 한 번 울린다 — 방금 켠 소리를 확인하고, iOS는 누른 순간 소리를 내야 오디오가 풀린다
    if (!next.muted && next.volume > 0 && (settings.muted || settings.volume <= 0)) playSound("chat", next);
  };

  /** 이름 바꾸기: 저장해 두면 게임 루프가 다음 동기화에 서버로 보낸다. 이름표는 서버가 받아들인 뒤 바뀐다 */
  const rename = (name: string) => {
    profileRef.current = { ...profileRef.current, name };
    saveLobbyProfile(profileRef.current);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`카피바라 온천 습지 마을 로비. 게임 오두막 ${world.doors.length}채`}
        // touch-none: 누른 채 끌 때 페이지가 스크롤·확대되지 않게
        className="absolute inset-0 size-full touch-none select-none"
      />

      {/* 있는 듯 없는 듯: 평소엔 반투명 알약, 입력할 때만 넓어지고 또렷해진다. 보내기는 Enter(모바일은 키보드 전송). 오른쪽 위 버튼 줄 자리는 비워 둔다 */}
      <form
        onSubmit={sendChat}
        className="group absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] flex w-44 max-w-[calc(100%-5.5rem)] items-center rounded-full bg-black/25 transition-[width,background-color] duration-150 has-[input:focus]:w-72 has-[input:focus]:bg-card/90 has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-primary motion-reduce:transition-none"
      >
        <Input
          ref={chatInputRef}
          name="lobby-chat"
          aria-label="채팅"
          placeholder="Enter로 채팅…"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={CHAT_MAX}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.currentTarget.blur();
          }}
          shape="pill"
          className="h-8 min-w-0 flex-1 border-transparent bg-transparent pl-3 pr-1 text-base text-white shadow-none placeholder:text-white/60 focus-visible:ring-0 group-has-[input:focus]:text-text-strong group-has-[input:focus]:placeholder:text-text-placeholder md:text-caption-1"
        />
        <EmotePicker onPick={sendEmote} />
        <p aria-live="polite" className="sr-only">
          {heardChat}
        </p>
      </form>

      {/* 오른쪽 위 세로 줄: 카피바라 옷장 → 낚시 가방 → 효과음 → 이름 바꾸기. 설정 버튼은 나중에 이 줄에 다시 넣는다 */}
      {/* 효과음 버튼의 헤드폰이 원 밖으로 삐져나오는 만큼 위(옷장)·오른쪽(화면 끝)을 띄운다. 두 버튼은 앉기·때리기와 같은 크기(모바일 size-14, md 이상 size-18) */}
      <div className="absolute right-[max(1.25rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] flex flex-col items-center gap-6">
        <Wardrobe
          onChange={(outfit) => {
            outfitRef.current = outfit;
          }}
        />
        <FishBag
          inventory={fishInventory}
          satiety={satiety}
          onFeed={(name) => {
            feedRequest.current = name;
          }}
        />
        <SoundToggle settings={settings} onChange={updateSettings} />
        <ProfileName name={myName} onRename={rename} />
      </div>

      {/* 왼쪽 아래 미니맵: 보기 전용이라 터치는 아래 로비 캔버스(조이스틱)로 지나간다 */}
      <canvas
        ref={minimapRef}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] size-20 rounded-lg border-2 border-white/40 shadow-md sm:size-32"
      />

      {/* 가운데 안내 글: 왼쪽 아래 미니맵(모바일 폭 ~5.75rem, sm 이상 ~8.75rem)·오른쪽 아래 버튼 줄(폭 ~5.5rem)을 가리지 않게 양옆을 비우고, 맨 아래 사이트 링크 줄 위에 둔다 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-24 sm:px-40 pb-[max(2.75rem,calc(env(safe-area-inset-bottom)+2rem))]">
        <p
          role="status"
          aria-live="polite"
          className="max-w-full rounded-xl bg-card/90 px-4 py-2 text-center text-body-2 font-semibold text-text-strong shadow-sm empty:hidden"
        >
          {status}
        </p>
      </div>

      <KeyboardGuide />

      <GuestbookPanel open={guestbookOpen} onClose={() => setGuestbookOpen(false)} />

      {/* 터치 조이스틱: 누른 자리에 나타난다. 위치는 게임 루프가 DOM에 직접 쓴다 */}
      <div ref={joystickRef} hidden aria-hidden="true" className="pointer-events-none fixed left-0 top-0 size-32">
        <NextImage src={`${UI_BASE}/joystick-base.webp`} alt="" width={256} height={256} unoptimized draggable={false} className="absolute inset-0 size-full opacity-90" />
        <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-7 -mt-7 size-14">
          <NextImage src={`${UI_BASE}/joystick-knob.webp`} alt="" width={256} height={256} unoptimized draggable={false} className="size-full drop-shadow-md" />
        </div>
      </div>

      {/* 오른쪽 아래 세로 줄: 앉기 → 때리기 → 사이트 링크. 오른쪽 끝은 위 옷장·효과음 줄(right-5)과 맞추고, 링크는 맨 아래 줄에 둔다 */}
      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] flex flex-col items-end gap-3">
        <div className="flex flex-col items-center gap-2">
          {(seatNearby || sitting) && (
            <button
              ref={sitButtonRef}
              type="button"
              onClick={() => {
                spaceRequest.current = true;
              }}
              aria-pressed={sitting}
              aria-label={sitting ? "일어나기" : "통나무에 앉기"}
              aria-keyshortcuts="Space"
              className="group flex flex-col items-center gap-0.5 rounded-full focus-visible:outline-2 focus-visible:outline-primary"
            >
              {/* 누르면 그림과 아이콘이 같이 줄어들게 감싼 쪽에 scale을 준다 */}
              <span className="relative block size-14 transition-transform md:size-18 duration-100 motion-safe:group-active:scale-90">
                <NextImage
                  src={`${UI_BASE}/sit.webp`}
                  alt=""
                  width={256}
                  height={256}
                  unoptimized
                  draggable={false}
                  className={cn("size-full drop-shadow-md", sitting && "brightness-90")}
                />
                {/* 마우스를 올리거나 키보드 포커스면 나무 테 안쪽 판 위에 의자 아이콘 (프로필·효과음과 같은 방식) */}
                <span
                  aria-hidden
                  className="absolute inset-[16%] flex items-center justify-center rounded-full bg-overlay text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 group-data-flash:opacity-100 motion-reduce:transition-none"
                >
                  <Armchair className="size-7" />
                </span>
              </span>
              <span className="rounded-full bg-card/85 px-2 py-0.5 text-caption-3 font-semibold text-text-strong">{sitting ? "일어나기" : "앉기"}</span>
            </button>
          )}
          {bath && (
            <button
              ref={bathButtonRef}
              type="button"
              onClick={() => {
                spaceRequest.current = true;
              }}
              aria-pressed={bath === "in"}
              aria-label={bath === "in" ? "온천에서 나오기" : "온천에서 목욕하기"}
              aria-keyshortcuts="Space"
              className="group flex flex-col items-center gap-0.5 rounded-full focus-visible:outline-2 focus-visible:outline-primary"
            >
              {/* 나무 테(방명록·옷장과 같은 그림) 안 펠트 판 위에 욕조 아이콘. 누르면 그림과 아이콘이 같이 줄어든다 */}
              <span className="relative block size-14 transition-transform md:size-18 duration-100 motion-safe:group-active:scale-90">
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-[16%] flex items-center justify-center rounded-full bg-capybara-light text-capybara-dark",
                    bath === "in" && "brightness-90",
                  )}
                >
                  <Bath className="size-6 md:size-7" />
                </span>
                <NextImage src={FRAME_SRC} alt="" fill unoptimized sizes="72px" draggable={false} className="drop-shadow-md" />
              </span>
              <span className="rounded-full bg-card/85 px-2 py-0.5 text-caption-3 font-semibold text-text-strong">{bath === "in" ? "나오기" : "목욕"}</span>
            </button>
          )}
          {guestbookNearby && (
            <button
              ref={guestbookButtonRef}
              type="button"
              onClick={() => {
                spaceRequest.current = true;
              }}
              aria-expanded={guestbookOpen}
              aria-label="방명록 보기"
              aria-keyshortcuts="Space"
              className="group flex flex-col items-center gap-0.5 rounded-full focus-visible:outline-2 focus-visible:outline-primary"
            >
              {/* 나무 테(옷장·효과음과 같은 그림) 안 펠트 판 위에 공책 아이콘 */}
              <span className="relative block size-14 transition-transform md:size-18 duration-100 motion-safe:group-active:scale-90">
                <span aria-hidden className="absolute inset-[16%] flex items-center justify-center rounded-full bg-capybara-light text-capybara-dark">
                  <NotebookPen className="size-6 md:size-7" />
                </span>
                <NextImage src={FRAME_SRC} alt="" fill unoptimized sizes="72px" draggable={false} className="drop-shadow-md" />
              </span>
              <span className="rounded-full bg-card/85 px-2 py-0.5 text-caption-3 font-semibold text-text-strong">방명록</span>
            </button>
          )}
          {(waterNearby || fishing || autoFishing) && (
            <button
              ref={fishButtonRef}
              type="button"
              onClick={() => {
                spaceRequest.current = true;
              }}
              aria-pressed={autoFishing}
              aria-label={autoFishing ? "낚시 그만하기" : "낚시하기 (멈출 때까지 계속 낚아요)"}
              aria-keyshortcuts="Space"
              className="group flex flex-col items-center gap-0.5 rounded-full focus-visible:outline-2 focus-visible:outline-primary"
            >
              {/* 누르면 그림과 아이콘이 같이 줄어들게 감싼 쪽에 scale을 준다 */}
              <span className="relative block size-14 transition-transform md:size-18 duration-100 motion-safe:group-active:scale-90">
                <NextImage
                  src={FISH_BUTTON_SRC}
                  alt=""
                  width={256}
                  height={256}
                  unoptimized
                  draggable={false}
                  className={cn("size-full drop-shadow-md", autoFishing && "brightness-90")}
                />
                {/* 마우스를 올리거나 키보드 포커스면 나무 테 안쪽 판 위에 물고기 아이콘 (앉기·때리기와 같은 방식) */}
                <span
                  aria-hidden
                  className="absolute inset-[16%] flex items-center justify-center rounded-full bg-overlay text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 group-data-flash:opacity-100 motion-reduce:transition-none"
                >
                  <Fish className="size-7" />
                </span>
              </span>
              <span className="rounded-full bg-card/85 px-2 py-0.5 text-caption-3 font-semibold text-text-strong">{autoFishing ? "그만" : "낚시"}</span>
            </button>
          )}
          <button
            ref={attackButtonRef}
            type="button"
            onClick={() => {
              attackRequest.current = true;
            }}
            disabled={stunned}
            aria-label="때리기 (F)"
            aria-keyshortcuts="F"
            className="group flex flex-col items-center gap-0.5 rounded-full focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
          >
            {/* 누르면 그림과 아이콘이 같이 줄어들게 감싼 쪽에 scale을 준다 */}
            <span className="relative block size-14 transition-transform md:size-18 duration-100 motion-safe:group-active:scale-90">
              <NextImage
                src={`${UI_BASE}/punch.webp`}
                alt=""
                width={256}
                height={256}
                unoptimized
                draggable={false}
                className="size-full drop-shadow-md"
              />
              {/* 마우스를 올리거나 키보드 포커스면 나무 테 안쪽 판 위에 주먹 아이콘 (프로필·효과음과 같은 방식) */}
              <span
                aria-hidden
                className="absolute inset-[16%] flex items-center justify-center rounded-full bg-overlay text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 group-data-flash:opacity-100 motion-reduce:transition-none"
              >
                <HandFist className="size-7" />
              </span>
            </span>
            <span className="rounded-full bg-card/85 px-2 py-0.5 text-caption-3 font-semibold text-text-strong">때리기</span>
          </button>
        </div>
        <nav aria-label="사이트 정보" className="flex items-center gap-3 text-caption-3 drop-shadow-md">
          {SITE_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => markLobbyExit(href)}
              className={cn(
                "flex min-h-6 items-center rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                // 문의는 있는 듯 없는 듯 옅게
                href === "/contact" ? "text-white/45 hover:text-white/80" : "text-white/85 hover:text-white",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* 이미지를 다 받을 때까지 검은 캔버스 대신 로딩창으로 덮는다. 서버 렌더에도 들어가 JS가 뜨기 전부터 보인다 */}
      {loadProgress < 100 && (
        <div className="absolute inset-0 z-max flex touch-none items-center justify-center bg-background">
          <Loading description="로비 불러오는 중…" progress={loadProgress} />
        </div>
      )}
    </>
  );
}
