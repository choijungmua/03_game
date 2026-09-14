import dynamic from "next/dynamic";

import type { GameEntry } from "./types";

export const GAMES: GameEntry[] = [
  {
    slug: "reaction-time",
    title: "반응속도 테스트",
    description: "3·2·1 카운트다운이 끝나는 순간 눌러서 반응 속도(ms)를 재고 등급과 순위를 확인하는 게임",
    tier: "S",
    playDifficulty: "쉬움",
    component: dynamic(() => import("@/app/games/_games/reaction-time")),
  },
  {
    slug: "click-speed",
    title: "클릭 스피드 테스트",
    description: "3·2·1 카운트다운 후 초록 화면을 최대한 빠르게 연타해서 클릭 수와 초당 속도로 등급과 순위를 확인하는 게임",
    tier: "S",
    playDifficulty: "쉬움",
    component: dynamic(() => import("@/app/games/_games/click-speed")),
  },
  {
    slug: "capybara-sneak",
    title: "카피바라 몰래 먹기",
    description: "주인이 등을 돌린 사이에 화면을 꾹 눌러 수박을 다 먹어야 하는 카피바라 타이밍 게임",
    tier: "A",
    playDifficulty: "쉬움",
    component: dynamic(() => import("@/app/games/_games/capybara-sneak")),
  },
  {
    slug: "capybara-plane-shooter",
    title: "카피바라 비행기 슈팅",
    description: "카피바라 조종사가 풀잎탄을 쏘며 하피독수리·말벌·재규어를 격추하고, 간식 아이템으로 무기를 바꾸며 카이만 보스를 버티는 세로 슈팅 게임",
    tier: "A",
    playDifficulty: "보통",
    component: dynamic(() => import("@/app/games/_games/capybara-plane-shooter")),
  },
  {
    slug: "capybara-baduk",
    title: "카피바라 바둑",
    description: "초대 코드로 친구를 불러 9줄 바둑판에서 1:1로 두는 온라인 바둑",
    tier: "C",
    playDifficulty: "보통",
    component: dynamic(() => import("@/app/games/_games/capybara-baduk")),
  },
  {
    slug: "capybara-gomoku",
    title: "카피바라 오목",
    description: "초대 코드로 친구를 불러 15줄 판에서 카피바라 돌 다섯 개를 먼저 한 줄로 잇는 온라인 오목",
    tier: "C",
    playDifficulty: "보통",
    component: dynamic(() => import("@/app/games/_games/capybara-gomoku")),
  },
  {
    slug: "capybara-alkkagi",
    title: "카피바라 알까기",
    description: "초대 코드로 친구를 불러 카피바라 알을 튕겨 상대 알을 판 밖으로 떨어뜨리는 온라인 알까기",
    tier: "B",
    playDifficulty: "보통",
    component: dynamic(() => import("@/app/games/_games/capybara-alkkagi")),
  },
  {
    slug: "capybara-log-dodge",
    title: "카피바라 통나무 피하기",
    description: "비탈에서 굴러오는 통나무를 좌우로 피하고, 바닥 통나무는 점프로 넘고, 머리 높이 통나무는 숙여서 지나가며 오래 버티는 카피바라 게임. 매일 바뀌는 오늘의 코스와 친구 도전장 링크",
    tier: "A",
    playDifficulty: "보통",
    component: dynamic(() => import("@/app/games/_games/capybara-log-dodge")),
  },
  // 새 게임은 여기에 한 줄씩 추가 (CLAUDE.md "새 게임 추가 절차" 참고)
];

export function getGame(slug: string) {
  return GAMES.find((game) => game.slug === slug);
}
