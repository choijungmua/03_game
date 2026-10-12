import { expect, test } from "@playwright/test";

const routeBaseUrl = process.env.ROUTE_BASE_URL ?? "http://localhost:3300";

function routeUrl(path: string): string {
  return new URL(path, routeBaseUrl).toString();
}

test("returns 404 when the game slug is unknown", async ({ request }) => {
  const response = await request.get(routeUrl("/games/not-a-defense-map"), {
    timeout: 15_000,
  });

  expect(response.status()).toBe(404);
});

test("returns 404 for the removed capybara defense game", async ({ request }) => {
  const response = await request.get(routeUrl("/games/capybara-defense"), {
    timeout: 15_000,
  });

  expect(response.status()).toBe(404);
});

test("returns 404 for the removed capybara defense guide", async ({ request }) => {
  const response = await request.get(routeUrl("/games/capybara-defense/guide"));
  expect(response.status()).toBe(404);
});
