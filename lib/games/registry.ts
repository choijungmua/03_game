import dynamic from "next/dynamic";

import type { GameEntry } from "./types";

export const GAMES: GameEntry[] = [
  {
    slug: "reaction-time",
    title: "반응속도 테스트",
    description: "화면이 초록색으로 바뀌는 순간 클릭해서 반응 속도를 측정하는 게임",
    tier: "S",
    playDifficulty: "쉬움",
    component: dynamic(() => import("@/app/games/_games/reaction-time")),
  },
  {
    slug: "whack-a-mole",
    title: "두더지 잡기",
    description: "제한 시간 안에 나타나는 두더지를 터치해 점수를 올리는 게임",
    tier: "S",
    playDifficulty: "쉬움",
    component: dynamic(() => import("@/app/games/_games/whack-a-mole")),
  },
  {
    slug: "click-speed",
    title: "클릭 스피드 테스트",
    description: "정해진 시간 동안 최대한 많이 탭해서 클릭 속도를 측정하는 게임",
    tier: "S",
    playDifficulty: "쉬움",
    component: dynamic(() => import("@/app/games/_games/click-speed")),
  },
  // 새 게임은 여기에 한 줄씩 추가 (CLAUDE.md "새 게임 추가 절차" 참고)
];

export function getGame(slug: string) {
  return GAMES.find((game) => game.slug === slug);
}
