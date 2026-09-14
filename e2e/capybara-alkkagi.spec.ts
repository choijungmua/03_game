import type { Page } from "@playwright/test";

import { type AlkkagiState, createGame, shoot } from "@/app/games/_games/capybara-alkkagi/logic";
import type { RoomAction, RoomView } from "@/lib/games/rooms";

import { API_ORIGIN, expect, test } from "./support";

const CODE = "ABCDEF";
const TOKEN = "e2e-token-0000000000000000000000000000";

/**
 * 알까기 컴퓨터 방을 가짜 방 API로 띄운다. 나는 흑(갈색), 봇은 백.
 * 이모티콘을 보내면 방에 실리고, 샷을 보내면 서버처럼 규칙대로 두고 보낸 샷을 모아 둔다
 */
async function stubAlkkagiRoom(page: Page) {
  let state: AlkkagiState = { ...createGame(), turnStartedAt: Date.now() };
  let version = 1;
  let emote: RoomView<AlkkagiState>["emote"] = null;
  const shots: Partial<RoomAction>[] = [];

  const view = (): RoomView<AlkkagiState> => ({
    code: CODE,
    state,
    joined: { black: true, white: true },
    you: "black",
    now: Date.now(),
    version,
    emote,
    bot: true,
  });

  await page.route(`${API_ORIGIN}/api/games/capybara-alkkagi/rooms**`, (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname.endsWith("/rooms")) {
      if (request.method() === "GET") return route.fulfill({ json: { ok: true, rooms: [] } });
      return route.fulfill({ json: { ok: true, view: view(), token: TOKEN } });
    }
    if (request.method() === "POST") {
      const body: Partial<RoomAction> = request.postDataJSON();
      if (body.type === "emote") emote = { seat: "black", id: body.index ?? 0, at: Date.now() };
      if (body.type === "shoot") {
        shots.push(body);
        const result = shoot(state, body.index ?? -1, body.aim ?? { x: 0, y: 0 }, "black");
        if (result.ok) state = result.state;
      }
      version += 1;
    }
    return route.fulfill({ json: { ok: true, view: view(), token: null } });
  });

  return shots;
}

test("알까기: 이모티콘을 보낸 뒤에도 내 알을 당겨 칠 수 있다", async ({ page }) => {
  const shots = await stubAlkkagiRoom(page);
  await page.goto("/games/capybara-alkkagi");
  await page.getByRole("button", { name: "컴터랑 두기" }).click();
  await page.getByRole("button", { name: "중수" }).click();
  await expect(page.getByText("내 차례예요 (갈색 카피바라)")).toBeVisible();

  await page.getByRole("button", { name: "놀리기" }).click();
  await page.getByRole("button", { name: "메롱~" }).click();
  // 이모티콘 말풍선이 떠 있는 동안(판 위를 덮는다) 알을 당긴다
  await expect(page.getByText("메롱~")).toBeVisible();

  const piece = page.getByRole("button", { name: "내 갈색 카피바라" }).first();
  const box = await piece.boundingBox();
  if (!box) throw new Error("내 알이 화면에 없어요");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  // 뒤(아래)로 당겼다 놓으면 위로 날아간다
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 120, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => shots.length).toBe(1);
  expect(shots[0].type).toBe("shoot");
  await page.waitForTimeout(1500);
});
