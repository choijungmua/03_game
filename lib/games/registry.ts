import dynamic from "next/dynamic";

import { GAME_TITLES } from "./constants";
import type { GameEntry } from "./types";

export const GAMES: GameEntry[] = [
  {
    slug: "reaction-time",
    title: GAME_TITLES["reaction-time"],
    description: "3·2·1 카운트다운이 끝나는 순간 눌러서 반응 속도(ms)를 재고 등급과 순위를 확인하는 게임",
    tier: "S",
    playDifficulty: "쉬움",
    pageName: "reaction",
    component: dynamic(() => import("@/app/games/_games/reaction-time")),
    seo: () => import("@/app/games/_games/reaction-time/seo"),
  },
  {
    slug: "click-speed",
    title: GAME_TITLES["click-speed"],
    description: "3·2·1 카운트다운 후 초록 화면을 최대한 빠르게 연타해서 클릭 수와 초당 속도로 등급과 순위를 확인하는 게임",
    tier: "S",
    playDifficulty: "쉬움",
    pageName: "click",
    component: dynamic(() => import("@/app/games/_games/click-speed")),
    seo: () => import("@/app/games/_games/click-speed/seo"),
  },
  {
    slug: "capybara-plane-shooter",
    title: GAME_TITLES["capybara-plane-shooter"],
    description: "카피바라 조종사가 풀잎탄을 쏘며 하피독수리·말벌·재규어를 격추하고, 간식 아이템으로 무기를 바꾸며 카이만 보스를 버티는 세로 슈팅 게임",
    tier: "A",
    playDifficulty: "보통",
    pageName: "shooter",
    component: dynamic(() => import("@/app/games/_games/capybara-plane-shooter")),
    seo: () => import("@/app/games/_games/capybara-plane-shooter/seo"),
  },
  {
    slug: "capybara-baduk",
    title: GAME_TITLES["capybara-baduk"],
    description: "초대 코드로 친구를 부르거나 컴퓨터와 9줄 바둑판에서 1:1로 두는 온라인 바둑",
    tier: "C",
    playDifficulty: "보통",
    pageName: "baduk",
    component: dynamic(() => import("@/app/games/_games/capybara-baduk")),
    seo: () => import("@/app/games/_games/capybara-baduk/seo"),
    hideAbout: true,
  },
  {
    slug: "capybara-gomoku",
    title: GAME_TITLES["capybara-gomoku"],
    description: "초대 코드로 친구를 부르거나 컴퓨터와 15줄 판에서 카피바라 돌 다섯 개를 먼저 한 줄로 잇는 온라인 오목",
    tier: "C",
    playDifficulty: "보통",
    pageName: "gomoku",
    component: dynamic(() => import("@/app/games/_games/capybara-gomoku")),
    seo: () => import("@/app/games/_games/capybara-gomoku/seo"),
    hideAbout: true,
  },
  {
    slug: "capybara-alkkagi",
    title: GAME_TITLES["capybara-alkkagi"],
    description: "초대 코드로 친구를 부르거나 컴퓨터와 카피바라 알을 튕겨 상대 알을 판 밖으로 떨어뜨리는 온라인 알까기",
    tier: "B",
    playDifficulty: "보통",
    pageName: "alkkagi",
    component: dynamic(() => import("@/app/games/_games/capybara-alkkagi")),
    seo: () => import("@/app/games/_games/capybara-alkkagi/seo"),
    hideAbout: true,
  },
  {
    slug: "capybara-log-dodge",
    title: GAME_TITLES["capybara-log-dodge"],
    description: "비탈에서 굴러오는 통나무를 좌우로 피하고, 바닥 통나무는 점프로 넘고, 머리 높이 통나무는 숙여서 지나가며 오래 버티는 카피바라 게임. 매일 바뀌는 오늘의 코스와 친구 도전장 링크",
    tier: "A",
    playDifficulty: "보통",
    pageName: "dodge",
    component: dynamic(() => import("@/app/games/_games/capybara-log-dodge")),
    seo: () => import("@/app/games/_games/capybara-log-dodge/seo"),
  },
  {
    slug: "capybara-pang",
    title: GAME_TITLES["capybara-pang"],
    description: "60초 동안 옆 블록과 바꿔 같은 동물 3개를 이어 터뜨리는 매치3 퍼즐. 4개는 폭탄, 5개는 무지개, 콤보를 이으면 점수 두 배 피버",
    tier: "A",
    playDifficulty: "쉬움",
    pageName: "pang",
    component: dynamic(() => import("@/app/games/_games/capybara-pang")),
    seo: () => import("@/app/games/_games/capybara-pang/seo"),
  },
  // 새 게임은 여기에 한 줄씩 추가 (제목은 constants.ts GAME_TITLES에, CLAUDE.md "새 게임 추가 절차" 참고)
];

export function getGame(slug: string) {
  return GAMES.find((game) => game.slug === slug);
}

/** 모든 게임의 SEO 문구 (sitemap·RSS·llms.txt) */
export function getAllGameSeo() {
  return Promise.all(GAMES.map(async (game) => ({ game, seo: (await game.seo()).seo })));
}
