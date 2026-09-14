"use client";

// 캔버스용 new Image()와 이름이 겹치지 않게 NextImage로 가져온다
import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useEffectEvent, useRef, useState } from "react";

import { pretendard } from "@/config";
import { cn } from "@/lib";
import { Armchair, Fish, HandFist } from "lucide-react";
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
  CORRECTION_SNAP_PX,
  DEFAULT_LOBBY_SETTINGS,
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
import { pushSnapshot, sampleSnapshots, type Snapshot } from "@/lib/lobby/interpolation";
import { loadLobbyProfile, type LobbyProfile, saveLobbyProfile } from "@/lib/lobby/profile";
import { type LobbySettings, loadLobbySettings, playSound, saveLobbySettings } from "@/lib/lobby/settings";

import { CAPYBARA_EMOTES, emoteChat, emoteImage, parseEmoteChat } from "@/lib/games/emotes";

import { BUBBLE_LINE, BUBBLE_TEXT_WIDTH, EMOTE_SIZE, FISH_BUTTON_SRC, SITE_LINKS } from "./constants";
import { EmotePicker } from "./emote-picker";
import { FishBag } from "./fish-bag";
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
  BODY_LAYERS,
  HEAD_ELLIPSE,
  loadOutfit,
  type Outfit,
  OVER_HEAD_LAYERS,
  SLOT_INFO,
  type WardrobeAnchor,
  type WardrobeSlot,
  WARDROBE_SLOTS,
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
  nearestWater,
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
  walkDist: number;
  idleMs: number;
  stunUntil: number;
  attackUntil: number;
  outfit: Outfit;
  chat: string;
  chatUntil: number;
  /** 낚시 중이면 채팅으로 받은 동작(던지기·입질·당기기)으로 채운 줄 */
  fishing: FishingLine | null;
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
  ctx.font = `${strong ? 700 : 600} 13px ${CANVAS_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(40,28,16,0.85)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x, y);
}

/** 꼬리 끝이 (x, bottom)에 오는 흰 말풍선 몸통을 칠하고 몸통 top을 돌려준다. 꼬리는 몸통과 한 번에 채워 이음새가 안 보이게 */
function fillBubble(ctx: CanvasRenderingContext2D, x: number, bottom: number, width: number, height: number, radius: number) {
  const left = Math.round(x - width / 2);
  const top = Math.round(bottom - 5 - height);
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, radius);
  ctx.moveTo(x - 4, top + height - 1);
  ctx.lineTo(x, bottom);
  ctx.lineTo(x + 4, top + height - 1);
  ctx.closePath();
  ctx.save();
  ctx.shadowColor = "rgba(40,28,16,0.25)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();
  return top;
}

/** 카피바라 이모티콘 그림 하나를 담은 말풍선 */
function drawEmoteBubble(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, bottom: number) {
  const size = EMOTE_SIZE + 8;
  const top = fillBubble(ctx, x, bottom, size, size, 14);
  ctx.drawImage(image, Math.round(x - EMOTE_SIZE / 2), top + 4, EMOTE_SIZE, EMOTE_SIZE);
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
  /** 옷 이미지 (처음 부를 때 불러온다) */
  image: (src: string) => HTMLImageElement;
  /**
   * 옷 입은 스프라이트를 구워 둔 캔버스. size는 화면에 그릴 크기(CSS px)이고, 캔버스는 size × 기기 픽셀 비율로 딱 맞게 굽는다
   * (서 있으면 76 → 152px, 앉으면 64 → 128px). 입은 옷이 없거나 옷 이미지를 아직 불러오는 중이면 null
   */
  dressed: (base: HTMLImageElement, outfit: Outfit, view: Facing | "sit-down", size: number) => HTMLCanvasElement | null;
}

/**
 * 스프라이트 한 장(left, top, 정사각형 size) 위에 옷을 전부 입힌다.
 * 앉은 정면은 옷장 미리보기와 같은 그림이라 옷장 자리(SLOT_INFO), 나머지 동작은 서 있는 몸 상자 자리(WORLD_ANCHORS)에서
 * 바라보는 방향(앞·뒤·옆·앞대각선·뒤대각선)의 자리를 쓴다. 왼쪽을 보는 방향은 오른쪽 기준 자리와 그림을 좌우 반전한다
 */
function drawOutfit(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  outfit: Outfit,
  view: Facing | "sit-down",
  left: number,
  top: number,
  size: number,
  outfitImage: (src: string) => HTMLImageElement,
) {
  const sitting = view === "sit-down";
  const wardrobeView = sitting ? "front" : VIEW_OF[view];
  const flip = !sitting && view.endsWith("left");
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
  wardrobe: OutfitDrawer,
  now: number,
  animate: boolean,
) {
  /** 옷 입은 스프라이트 한 장. 구워 둔 캔버스가 있으면 한 번에, 옷 이미지를 불러오는 중이면 겹쳐 그린다 */
  const drawDressed = (image: HTMLImageElement, view: Facing | "sit-down", left: number, top: number, size: number) => {
    const dressed = wardrobe.dressed(image, outfit, view, size);
    if (dressed) {
      ctx.drawImage(dressed, left, top, size, size);
      return;
    }
    ctx.drawImage(image, left, top, size, size);
    drawOutfit(ctx, image, outfit, view, left, top, size, wardrobe.image);
  };
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
      drawDressed(image, "down", -STAND_SIZE / 2, -STAND_SIZE * STAND_FOOT, STAND_SIZE);
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
          : key === walkKey
            ? facing // 서기·걷기는 대각선 스프라이트가 있어서 대각선 자리
            : direction;
  if (key.startsWith("doze") && animate) {
    // 조는 동안 몸이 천천히 앞뒤로 흔들린다
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(now / 650) * 0.035);
    drawDressed(image, view, -size / 2, -size * foot, size);
    ctx.restore();
    return;
  }
  if ((key === "scratch-2" || key === "scratch-3") && animate) {
    // 작게 그리면 앞발 움직임만으론 안 보여서, 긁는 박자에 맞춰 엉덩이를 좌우로 씰룩인다
    const wiggle = key === "scratch-2" ? -1 : 1;
    ctx.save();
    ctx.translate(x + wiggle * 1.5, y);
    ctx.rotate(wiggle * 0.05);
    drawDressed(image, view, -size / 2, -size * foot, size);
    ctx.restore();
    return;
  }
  if (look.stride > 0 && animate) {
    // 한 걸음(프레임 2장)마다 몸이 살짝 떴다 내려앉고 좌우로 기울어 뒤뚱뒤뚱 걷는다
    const step = Math.sin((look.stride / (STRIDE_PX * 2)) * Math.PI);
    ctx.save();
    ctx.translate(x, y - Math.abs(step) * 3);
    ctx.rotate(step * 0.045);
    drawDressed(image, view, -size / 2, -size * foot, size);
    ctx.restore();
    return;
  }
  drawDressed(image, view, x + fx * lunge - size / 2, y + fy * lunge - size * foot, size);
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
  /** Space(앉기·낚시 버튼): 통나무 앞이면 앉기·일어나기, 물가면 계속 낚기 시작·그만하기 */
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
  const lastChatAt = useRef(-Infinity);
  /** 화면(설정 창·소리 버튼)은 state, 게임 루프는 ref로 같은 설정을 읽는다 */
  const [settings, setSettings] = useState<LobbySettings>(DEFAULT_LOBBY_SETTINGS);
  const settingsRef = useRef<LobbySettings>(DEFAULT_LOBBY_SETTINGS);
  /** 스크린리더용: 캔버스 말풍선은 읽히지 않아서 방금 들은 채팅을 글로도 둔다 */
  const [heardChat, setHeardChat] = useState("");
  const [world] = useState(() => createWorld(LOBBY_SEED, games));
  const [activeDoor, setActiveDoor] = useState<Door | null>(null);
  const [sitting, setSitting] = useState(false);
  const [seatNearby, setSeatNearby] = useState(false);
  const [waterNearby, setWaterNearby] = useState(false);
  const [fishing, setFishing] = useState(false);
  /** 계속 낚기: 물가에서 Space로 던지면 켜져서 입질마다 알아서 당기고 다시 던진다. Space를 다시 누르거나 걷기·때리기·기절이면 꺼진다. 게임 루프는 ref로 읽는다 */
  const [autoFishing, setAutoFishing] = useState(false);
  const autoFishingRef = useRef(false);
  /** 낚시 가방. 게임 루프가 낚을 때마다 저장하고 새 값을 넣는다 */
  const [fishInventory, setFishInventory] = useState<FishInventory>({});
  const [stunned, setStunned] = useState(false);
  const [notice, setNotice] = useState("");
  /** 로비 이미지를 받은 비율(%). 100이 되기 전엔 로딩창을 덮고 게임 루프를 돌리지 않는다 */
  const [loadProgress, setLoadProgress] = useState(0);
  // 게임 루프 effect가 router 변경으로 다시 실행되면 캐릭터·멀티 상태가 초기화되므로 이벤트로 감싼다
  const goToGame = useEffectEvent((slug: string) => router.push(`/games/${slug}`));
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
    // 저장된 설정은 서버 렌더와 어긋나지 않게 화면에 붙은 뒤 읽는다
    settingsRef.current = loadLobbySettings();
    setFishInventory(loadFishInventory());
    setSettings(settingsRef.current);

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
    /** 머리 위 말풍선. 카피바라 이모티콘이면 그림으로, 그림이 아직 안 받아졌으면 그 이모티콘 글로 */
    const drawSpeech = (text: string, x: number, bottom: number) => {
      const emote = parseEmoteChat(text);
      if (emote === null) return drawBubble(ctx, text, x, bottom);
      const image = outfitImage(emoteImage(emote));
      if (ready(image)) drawEmoteBubble(ctx, image, x, bottom);
      else drawBubble(ctx, CAPYBARA_EMOTES[emote], x, bottom);
    };
    // 옷 입은 스프라이트는 (스프라이트·방향·옷 조합)마다 한 번만 캔버스에 구워 두고, 매 프레임엔 그 한 장만 그린다
    const dressedCache = new Map<string, HTMLCanvasElement>();
    /** 캔버스의 기기 픽셀 비율 (resize에서 갱신). 옷 입은 스프라이트를 화면 크기에 딱 맞게 굽는 데 쓴다 */
    let pixelRatio = 1;
    const wardrobe: OutfitDrawer = {
      image: outfitImage,
      dressed: (base, outfit, view, size) => {
        const worn = WARDROBE_SLOTS.flatMap((slot) => {
          const id = outfit[slot];
          return id ? [`${slot}:${id}`] : [];
        });
        if (worn.length === 0) return null;
        // 그릴 크기 그대로 구워서 매 프레임 확대·축소 없이 1:1로 찍는다 (크기가 키에 들어가 화면 배율이 바뀌면 새로 굽는다)
        const px = Math.ceil(size * pixelRatio);
        const key = `${base.src}|${view}|${px}|${worn.join(",")}`;
        const cached = dressedCache.get(key);
        if (cached) return cached;
        // 옷 이미지를 다 불러온 뒤에만 굽는다 (덜 불러온 채 구우면 빠진 옷이 그대로 굳는다)
        const loaded = WARDROBE_SLOTS.every((slot) => {
          const id = outfit[slot];
          return !id || ready(outfitImage(wardrobeSrc(slot, id)));
        });
        if (!loaded) return null;
        const canvas = document.createElement("canvas");
        canvas.width = px;
        canvas.height = px;
        const bake = canvas.getContext("2d");
        if (!bake) return null;
        bake.drawImage(base, 0, 0, px, px);
        drawOutfit(bake, base, outfit, view, 0, 0, px, outfitImage);
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
      chat: "",
      chatUntil: 0,
      /** 낚시 중이면 찌 위치(물 타일 가운데, px)와 던지기·입질·당기기 시각. 다른 사람에겐 채팅으로 알린다 */
      fishing: null as FishingLine | null,
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
    let chatQueued: string | null = null;
    let shownDoor: Door | null = null;
    let shownSitting = false;
    let shownSeat = false;
    let shownWater = false;
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
      // 채팅 입력 중엔 WASD·F·Space가 글자로 들어가야 한다
      if (event.target instanceof HTMLInputElement) return;
      // \ 키 조작법 창은 KeyboardGuide가 연다. 여는 순간 처음 안내 글은 치운다
      if (isShortcutKey(event, "Backslash")) {
        setNotice("");
        return;
      }
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
          flashButton(sitButtonRef.current ?? fishButtonRef.current);
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
      if (chatQueued === null && fishQueued !== null && now - lastChatAt.current >= CHAT_COOLDOWN_MS + 100) {
        chatQueued = fishQueued;
        fishQueued = null;
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
        if (me.sitting) standUp();
        reelLine(received, false);
        stopAuto();
      } else if (
        data.corrected &&
        Math.hypot(data.you.x - me.x, data.you.y - me.y) > CORRECTION_SNAP_PX &&
        !blocked(data.you.x, data.you.y)
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
        if (newChat && fish === null) {
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
          remote.sitting = player.sitting;
          remote.outfit = player.outfit ?? {};
          remote.stunUntil = stunUntil;
          remote.chat = player.chat;
          remote.chatUntil = chatUntil;
          remote.fishing = nextFishing(remote.fishing);
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
            walkDist: 0,
            idleMs: 0,
            stunUntil,
            attackUntil: player.attackMs > 0 ? received + player.attackMs : 0,
            chat: player.chat,
            chatUntil,
            outfit: player.outfit ?? {},
            fishing: nextFishing(null),
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
        } else if (nearestSeat() < 0 && water) {
          // 한 번 던지면 멈출 때까지 입질마다 알아서 당기고 다시 던진다 (아래 게임 루프)
          castLine(water, now);
          autoFishingRef.current = true;
          setAutoFishing(true);
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
            playSound("sit", settingsRef.current);
          } else {
            showNotice(index >= 0 ? "누가 이미 앉아 있어요" : "통나무 의자 앞에서 앉고, 물가에서 낚시할 수 있어요");
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
      if (wantsMove && me.sitting) standUp(); // 움직이면 일어난다
      if (wantsMove) {
        // 움직이면 낚싯대를 거둔다 (빈 찌를 감아 오는 모습은 남긴다)
        reelLine(now, false);
        stopAuto();
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
      me.idleMs = moved || wantsMove || me.sitting || me.fishing || isStunned || attacking ? 0 : nextIdle(me.idleMs, dt);
      // 발을 내딛는 프레임마다 톡, 긁는 박자마다 슥슥, 하품을 시작할 때 하아암
      if (me.pose !== soundPose && me.pose !== "stand") {
        // 발 밑 타일에 따라 풀밭 사각, 나무 데크 통, 진흙 철퍽
        const ground = tileAt(Math.floor(me.x / TILE), Math.floor(me.y / TILE));
        playSound(ground === "deck" ? "stepDeck" : ground === "mud" ? "stepMud" : "step", settingsRef.current);
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
      // 당기고 끌어올리는 중엔 이미 낚시가 끝난 것으로 보여 준다
      const fishingActive = me.fishing !== null && me.fishing.reelAt === Infinity;
      const waterHere = !fishingActive && !me.sitting && !seatHere && nearestWater(tileAt, me.x, me.y, FISH_REACH) !== null;
      if (waterHere !== shownWater) setWaterNearby((shownWater = waterHere));
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
        const busy = moving || remote.sitting || remote.fishing !== null || now < remote.stunUntil || now < remote.attackUntil;
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
      const { spring } = world;
      if (inView(spring.x, spring.y, TILE * 6)) {
        // 온천은 납작해서 늘 캐릭터보다 먼저 그린다. 뒤(북쪽)는 물 타일이 막아 캐릭터가 그림과 겹칠 만큼 못 다가가고,
        // 가운데보다 아래를 기준으로 두면 옆에 선 캐릭터가 둘레 돌 그림에 가려진다
        drawables.push({
          y: spring.y - SPRING_RADIUS * TILE,
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
            drawCapybara(ctx, sprites, remote.x, remote.y, remote.facing, look, remote.outfit, wardrobe, now, !reducedMotion),
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
        draw: () => drawCapybara(ctx, sprites, drawnX, drawnY, me.facing, myLook, outfitRef.current, wardrobe, now, !reducedMotion),
      });
      drawables.sort((a, b) => a.y - b.y);
      for (const item of drawables) item.draw();

      for (const item of world.doors) {
        if (inView(item.x, item.y, TILE * 4)) drawLabel(ctx, item.title, item.x, item.y + TILE * 0.85, true);
      }
      for (const remote of remotes.values()) {
        const labelY = remote.y - (remote.sitting ? SIT_SIZE : STAND_SIZE) - 8;
        drawLabel(ctx, remote.name, remote.x, labelY);
        // 낚싯대·공중의 찌와 물고기는 이름표를 가리지 않게 머리 위로 끌어올려 이름표 다음에 그린다
        if (remote.fishing) drawFishingRod(ctx, remote.fishing, remote.x, remote.y, remote.facing, now, !reducedMotion, labelY);
        if (now < remote.chatUntil && parseFishChat(remote.chat) === null) drawSpeech(remote.chat, remote.x, labelY - 10);
      }
      const myLabelY = drawnY - (me.sitting ? SIT_SIZE : STAND_SIZE) - 8;
      if (me.name) drawLabel(ctx, me.name, drawnX, myLabelY);
      const mySpeechY = me.name ? myLabelY - 10 : myLabelY + 4;
      if (me.fishing) drawFishingRod(ctx, me.fishing, drawnX, drawnY, me.facing, now, !reducedMotion, mySpeechY + 10);
      if (now < me.chatUntil) drawSpeech(me.chat, drawnX, mySpeechY);
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
        return id ? [outfitImage(wardrobeSrc(slot, id))] : [];
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
      // 조작법은 숨겨 두었으니 처음에 여는 법만 알려 준다 (터치는 \ 키가 없어 걷는 법을 바로 알려 준다)
      const touch = window.matchMedia("(pointer: coarse)").matches;
      showNotice(touch ? "화면을 누른 채 끌면 걸어요 · 오두막 문 앞에 가면 입장" : "\\ 키를 누르면 조작법이 보여요", 5000);
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

  const status = stunned ? "기절! 2초 동안 못 움직여요" : notice || (activeDoor ? `${activeDoor.title} 들어가는 중… (Enter로 바로)` : "");

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
    setSettings(next);
    saveLobbySettings(next);
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
        className="group absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] flex w-44 max-w-[calc(100%-5.5rem)] items-center rounded-full bg-black/25 transition-[width,background-color] duration-150 has-[input:focus]:w-72 has-[input:focus]:bg-card/90 has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-primary motion-reduce:transition-none"
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
      <div className="absolute right-5 top-[max(0.75rem,env(safe-area-inset-top))] flex flex-col items-center gap-6">
        <Wardrobe
          onChange={(outfit) => {
            outfitRef.current = outfit;
          }}
        />
        <FishBag inventory={fishInventory} />
        <SoundToggle settings={settings} onChange={updateSettings} />
        <ProfileName name={myName} onRename={rename} />
      </div>

      {/* 왼쪽 아래 미니맵: 보기 전용이라 터치는 아래 로비 캔버스(조이스틱)로 지나간다 */}
      <canvas
        ref={minimapRef}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 size-20 rounded-lg border-2 border-white/40 shadow-md sm:size-32"
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

      {/* 터치 조이스틱: 누른 자리에 나타난다. 위치는 게임 루프가 DOM에 직접 쓴다 */}
      <div ref={joystickRef} hidden aria-hidden="true" className="pointer-events-none fixed left-0 top-0 size-32">
        <NextImage src={`${UI_BASE}/joystick-base.webp`} alt="" width={256} height={256} unoptimized draggable={false} className="absolute inset-0 size-full opacity-90" />
        <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-7 -mt-7 size-14">
          <NextImage src={`${UI_BASE}/joystick-knob.webp`} alt="" width={256} height={256} unoptimized draggable={false} className="size-full drop-shadow-md" />
        </div>
      </div>

      {/* 오른쪽 아래 세로 줄: 앉기 → 때리기 → 사이트 링크. 오른쪽 끝은 위 옷장·효과음 줄(right-5)과 맞추고, 링크는 맨 아래 줄에 둔다 */}
      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-5 flex flex-col items-end gap-3">
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
