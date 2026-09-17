import { expect, test } from "./support";

test("내 카피바라 메뉴가 화면 크기에 맞춰 열린다", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "내 카피바라 메뉴", exact: true });
  await expect(trigger).toBeVisible();

  await trigger.click();

  const menu = page.getByRole("dialog", { name: "내 카피바라" });
  await expect(menu).toBeVisible();
  await expect(menu.getByText("옷장", { exact: true })).toBeVisible();
  await expect(menu.getByText("가방", { exact: true })).toBeVisible();
  await expect(menu.getByText("소리", { exact: true })).toBeVisible();
  await expect(menu.getByText("이름", { exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toHaveAttribute("inert", "");
  await expect(trigger).toBeFocused();
});
