import type { WebSocketRoute } from "@playwright/test";

import type { LobbyMessage, PresenceRequest } from "@/lib/lobby/presence";

import { expect, test } from "./support";

/** 가짜 로비 서버가 처음 붙여 주는 이름과, 이미 다른 사람이 쓰고 있다고 치는 이름 */
const RANDOM_NAME = "졸린 치킨바라";
const TAKEN_NAME = "하나바라";

/** 백엔드처럼 요청의 name을 받아들이되 TAKEN_NAME은 거절하는 가짜 로비 WebSocket */
function fakeLobby(received: PresenceRequest[]) {
  return (ws: WebSocketRoute) => {
    let name = RANDOM_NAME;
    ws.onMessage((raw) => {
      const request: PresenceRequest = JSON.parse(String(raw));
      received.push(request);
      if (request.name && request.name !== TAKEN_NAME) name = request.name;
      const message: LobbyMessage = {
        you: { ...request, outfit: {}, id: "me", name, stunMs: 0, attackMs: 0, chat: "", chatMs: 0 },
        players: [],
        online: 1,
        hit: null,
        corrected: false,
      };
      ws.send(JSON.stringify(message));
    });
  };
}

const nameButton = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("button", { name: `이름 바꾸기 (지금 이름: ${name})` });

/** 이름 버튼은 오른쪽 위 "내 카피바라" 메뉴 안에 있다 */
async function openNameEditor(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "내 카피바라 메뉴", exact: true }).click();
  await nameButton(page, name).click();
}

test("이름을 바꾸면 서버에 프로필 id와 함께 보내고, 새로고침해도 유지된다", async ({ page }) => {
  const received: PresenceRequest[] = [];
  await page.routeWebSocket(/\/api\/lobby\/ws/, fakeLobby(received));
  await page.goto("/");

  await openNameEditor(page, RANDOM_NAME);
  const input = page.getByLabel(/머리 위에 보일 이름/);
  await expect(input).toHaveValue(RANDOM_NAME);
  await input.fill("  보리바라  ");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(nameButton(page, "보리바라")).toBeVisible();
  const last = received.at(-1);
  expect(last?.name).toBe("보리바라");
  expect(last?.profileId).toMatch(/^[0-9a-f-]{36}$/);

  await page.reload();
  await page.getByRole("button", { name: "내 카피바라 메뉴", exact: true }).click();
  await expect(nameButton(page, "보리바라")).toBeVisible();
  // 같은 기기면 새로고침해도 같은 프로필 id로 이력이 묶인다
  expect(received.at(-1)?.profileId).toBe(last?.profileId);
});

test("접속 중인 다른 사람 이름이면 알려 주고 이름표를 그대로 둔다", async ({ page }) => {
  await page.routeWebSocket(/\/api\/lobby\/ws/, fakeLobby([]));
  await page.goto("/");

  await openNameEditor(page, RANDOM_NAME);
  await page.getByLabel(/머리 위에 보일 이름/).fill(TAKEN_NAME);
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText(`“${TAKEN_NAME}” 이름은 다른 친구가 쓰고 있어요`)).toBeVisible();
  await expect(nameButton(page, RANDOM_NAME)).toBeVisible();
});

test("빈 이름은 저장하지 않고 입력창 옆에 알려 준다", async ({ page }) => {
  await page.routeWebSocket(/\/api\/lobby\/ws/, fakeLobby([]));
  await page.goto("/");

  await openNameEditor(page, RANDOM_NAME);
  await page.getByLabel(/머리 위에 보일 이름/).fill("  [] ");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("이름을 한 글자 이상 적어 주세요")).toBeVisible();
  await expect(page.getByRole("region", { name: "이름 바꾸기" })).toBeVisible();
});
