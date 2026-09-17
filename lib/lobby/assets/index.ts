// 로비 에셋 레지스트리. 새 에셋은 폴더를 만들고 여기에 한 줄 추가한다 (게임 registry와 같은 방식)

import deck from "./ground/deck";
import meadow from "./ground/meadow";
import mud from "./ground/mud";
import water from "./ground/water";
import hut1 from "./buildings/hut-1";
import hut2 from "./buildings/hut-2";
import hut3 from "./buildings/hut-3";
import bananaBush from "./nature/banana-bush";
import grassBush from "./nature/grass-bush";
import lotus from "./nature/lotus";
import palm from "./nature/palm";
import reeds from "./nature/reeds";
import rocks from "./nature/rocks";
import treeTropical from "./nature/tree-tropical";
import fence from "./props/fence";
import fencePost from "./props/fence-post";
import fenceVertical from "./props/fence-vertical";
import guestbookBoard from "./props/guestbook-board";
import lantern from "./props/lantern";
import logSeat from "./props/log-seat";
import onsen from "./props/onsen";
import yuzu from "./props/yuzu";
import type { LobbyAsset } from "./types";

export type { BuildingAsset, GroundAsset, LobbyAsset, LobbyAssetCategory, SpriteAsset } from "./types";

export const GROUND_ASSETS = [meadow, mud, water, deck] as const;
export const SPRITE_ASSETS = [treeTropical, palm, lotus, bananaBush, grassBush, rocks, reeds, fence, fenceVertical, fencePost, logSeat, lantern, guestbookBoard, onsen, yuzu] as const;
/** 오두막 모양. 게임 순서대로 돌려 쓴다 — 여기에 추가하면 오두막 종류가 늘어난다 */
export const BUILDING_ASSETS = [hut1, hut2, hut3] as const;

export type GroundId = (typeof GROUND_ASSETS)[number]["id"];
export type SpriteId = (typeof SPRITE_ASSETS)[number]["id"];

export const lobbyAssetSrc = (asset: Pick<LobbyAsset, "category" | "id">) =>
  `/assets/images/lobby/${asset.category}/${asset.id}/image.webp`;
