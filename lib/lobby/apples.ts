import { APPLE_REGROW_MS, APPLES_PER_TREE } from "./constants";

// 딴 사과가 어떤 종류인지는 서버가 정해 가방에 넣는다 (lib/lobby/server-fishing.ts의 pick 명령)

// ponytail: 딴 사과는 이 탭 메모리에만 남는다 (새로고침하면 다시 열리고, 다른 유저 나무에는 그대로 보인다).
// 모두가 같은 나무를 봐야 하면 백엔드 로비 상태에 나무별 딴 시각을 둘 것

/** 나무 한 그루에서 딴 시각들(performance.now) → 지금 달려 있는 사과 수. 딴 지 APPLE_REGROW_MS가 지난 건 다시 열린다 */
export const applesLeft = (pickedAt: readonly number[], now: number) =>
  Math.max(0, APPLES_PER_TREE - pickedAt.filter((at) => now - at < APPLE_REGROW_MS).length);

/** 사과를 하나 딴다. 남은 게 없으면 그대로 두고 false */
export function pickApple(pickedAt: number[], now: number) {
  if (applesLeft(pickedAt, now) === 0) return false;
  // 다시 열린 기록은 버려서 배열이 끝없이 늘지 않게 한다
  const recent = pickedAt.filter((at) => now - at < APPLE_REGROW_MS);
  pickedAt.splice(0, pickedAt.length, ...recent, now);
  return true;
}

/** 가장 가까운, reach(px) 안의 나무 번호. 없으면 -1 */
export function nearestTree(trees: readonly { x: number; y: number }[], x: number, y: number, reach: number) {
  let best = -1;
  let bestDistance = reach;
  trees.forEach((tree, i) => {
    const distance = Math.hypot(tree.x - x, tree.y - y);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}
