import type { Page, WebSocketRoute } from "@playwright/test";
import { createGame, type VolleyState } from "@/app/games/_games/capybara-volleyball/logic";

import { API_ORIGIN, expect, test } from "./support";

async function collectTelemetry(page: Page, slug: string) {
  const events: string[] = [];
  await page.route(`${API_ORIGIN}/api/games/${slug}/telemetry`, (route) => {
    events.push(route.request().postData() ?? "");
    return route.fulfill({ status: 202, body: "" });
  });
  return events;
}

const count = (events: readonly string[], type: string) => events.filter((event) => event.includes(`"eventType":"${type}"`)).length;

test("온라인 배구 대기·완료·재시작·연결 종료는 각각 올바른 판에 기록된다", async ({ page }) => {
  const events = await collectTelemetry(page, "capybara-volleyball");
  let connection: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/api\/games\/capybara-volleyball\/ws/, (socket) => {
    connection = socket;
    socket.send(JSON.stringify({ type: "room", side: 0, code: "TEST" }));
  });
  await page.goto("/games/capybara-volleyball");
  await page.getByRole("button", { name: "친구 초대하기 (온라인)" }).click();
  await expect(page.getByText("친구가 들어오면 바로 시작해요")).toBeVisible();
  expect(count(events, "game_start")).toBe(0);
  if (!connection) throw new TypeError("온라인 연결이 없습니다");
  connection.send(JSON.stringify({ type: "start" }));
  connection.send(JSON.stringify({ type: "start" }));
  await expect.poll(() => count(events, "game_start")).toBe(1);
  const state: VolleyState = { ...createGame(), winner: 0, score: [15, 0] };
  connection.send(JSON.stringify({ type: "state", state, events: ["win"] }));
  await expect.poll(() => count(events, "game_complete")).toBe(1);
  connection.send(JSON.stringify({ type: "state", state, events: [] }));
  await page.getByRole("button", { name: "다시 하기", exact: true }).click();
  await expect.poll(() => count(events, "game_start")).toBe(2);
  connection.close();
  await expect.poll(() => count(events, "game_quit")).toBe(1);
  expect(count(events, "game_complete")).toBe(1);
});

for (const slug of ["reaction-time", "click-speed", "capybara-pang", "capybara-run", "capybara-plane-shooter", "capybara-log-dodge", "watermelon-game"]) {
  test(`${slug}: 방문은 플레이가 아니며 실제 시작과 중단을 한 번씩 기록한다`, async ({ page }) => {
    const events = await collectTelemetry(page, slug);
    await page.goto(`/games/${slug}`);
    await expect(page.getByText("클릭해서 시작하세요", { exact: true })).toBeVisible();
    expect(count(events, "game_start")).toBe(0);
    await page.getByText("클릭해서 시작하세요", { exact: true }).click();
    await expect.poll(() => count(events, "game_start")).toBe(1);
    if (slug === "reaction-time" || slug === "click-speed" || slug === "capybara-pang") await page.getByRole("button", { name: "이번 판 그만하기" }).click();
    else await page.getByRole("link", { name: "로비로 돌아가기", exact: true }).click();
    await expect.poll(() => count(events, "game_quit")).toBe(1);
    expect(count(events, "game_complete")).toBe(0);
  });
}

test("0점 완료 후 재도전해 중단해도 이전 판 완료와 섞이지 않는다", async ({ page }) => {
  const events = await collectTelemetry(page, "click-speed");
  await page.goto("/games/click-speed");
  await page.getByRole("button", { name: "3초", exact: true }).click();
  await page.getByText("클릭해서 시작하세요", { exact: true }).click();
  await expect.poll(() => count(events, "game_complete"), { timeout: 10_000 }).toBe(1);
  await page.waitForTimeout(1100); // 결과 직후 연타로 재시작되는 것을 막는 1초 보호 구간.
  await page.keyboard.press("Enter");
  await expect.poll(() => count(events, "game_start")).toBe(2);
  await page.getByRole("button", { name: "이번 판 그만하기" }).click();
  await expect.poll(() => count(events, "game_quit")).toBe(1);
  expect(count(events, "game_complete")).toBe(1);
});

test("게임 목록에서 게임으로 이동해도 최초 검색 유입을 방문 요청에 보낸다", async ({ page }) => {
  const visits: string[] = [];
  await page.route(`${API_ORIGIN}/api/games/capybara-run/visits`, (route) => {
    visits.push(route.request().postData() ?? "");
    return route.fulfill({ status: 202, body: "" });
  });
  await page.goto("/games?utm_source=naver&utm_medium=search&utm_campaign=capybara");
  await page.locator('a[href="/games/capybara-run"]').first().click();
  await expect.poll(() => visits.length).toBe(1);
  expect(visits[0]).toContain('"landingPath":"/games"');
  expect(visits[0]).toContain('"utmSource":"naver"');
  expect(visits[0]).toContain('"utmCampaign":"capybara"');
});

test("배구는 컴퓨터 대전을 시작한 뒤에만 시작·일시정지 재개를 기록한다", async ({ page }) => {
  const events = await collectTelemetry(page, "capybara-volleyball");
  await page.goto("/games/capybara-volleyball");
  await expect(page.getByRole("button", { name: "컴퓨터와 하기" })).toBeVisible();
  expect(events).toEqual([]);
  await page.getByRole("button", { name: "컴퓨터와 하기" }).click();
  await expect.poll(() => count(events, "game_start")).toBe(1);
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.getByRole("button", { name: "이어하기", exact: true }).click();
  await expect.poll(() => count(events, "game_resume")).toBe(1);
  await page.getByRole("link", { name: "로비로 돌아가기", exact: true }).click();
  await expect.poll(() => count(events, "game_quit")).toBe(1);
});
