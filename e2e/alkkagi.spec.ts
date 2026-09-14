import { type AlkkagiState, createGame, MAX_SPEED, shoot } from "@/app/games/_games/capybara-alkkagi/logic";
import type { RoomView } from "@/lib/games/rooms";

import { API_ORIGIN, expect, test } from "./support";

const ROOMS_API = `${API_ORIGIN}/api/games/capybara-alkkagi/rooms`;
const CODE = "ABCDEF";

function roomView(state: AlkkagiState, version: number): RoomView<AlkkagiState> {
  return { code: CODE, state, joined: { black: true, white: true }, you: "black", now: Date.now(), version, emote: null, bot: true };
}

test("컴퓨터와 두는 알까기에서 상대 샷 애니메이션이 끝까지 재생되고 다시 내 차례가 된다", async ({ page }) => {
  // 봇(백)이 대장이 아닌 알 하나를 아래(흑 쪽)로 세게 친 판을 서버 대신 만든다
  const start: AlkkagiState = { ...createGame(), turn: "white", turnStartedAt: Date.now() };
  const shooter = start.pieces.find((piece) => piece.owner === "white" && !piece.leader);
  if (!shooter) throw new Error("백 알이 없어요");
  const shot = shoot(start, shooter.id, { x: 0, y: MAX_SPEED }, "white");
  if (!shot.ok) throw new Error(shot.error);

  // 방 만들기 → 시작 판, 첫 폴링은 시작 판 그대로, 그다음 폴링부터 봇이 친 판
  let polled = false;
  await page.route(`${ROOMS_API}**`, (route) => {
    const request = route.request();
    const isList = new URL(request.url()).pathname.endsWith("/rooms");
    if (isList && request.method() === "GET") return route.fulfill({ json: { ok: true, rooms: [] } });
    if (isList) return route.fulfill({ json: { ok: true, view: roomView(start, 1), token: "e2e-token" } });
    const view = polled ? roomView({ ...shot.state, turnStartedAt: Date.now() }, 2) : roomView(start, 1);
    polled = true;
    return route.fulfill({ json: { ok: true, view, token: null } });
  });

  await page.goto("/games/capybara-alkkagi");
  await page.getByRole("button", { name: "컴터랑 두기" }).click();
  await page.getByRole("button", { name: "중수" }).click();

  const rolling = page.getByText("데굴데굴…");
  await expect(rolling).toBeVisible();
  // 애니메이션이 에러로 끊기면 "데굴데굴…"에 멈춰 알을 칠 수 없게 된다 (pieces is not iterable 회귀)
  await expect(rolling).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText(/내 차례예요|한 번 더!/)).toBeVisible();
});
