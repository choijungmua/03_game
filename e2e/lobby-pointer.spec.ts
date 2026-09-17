import { expect, test } from "./support";

test("우클릭은 메뉴나 버튼 포커스 대신 로비 이동으로 처리된다", async ({ page }) => {
  await page.goto("/");

  const attack = page.getByRole("button", { name: "때리기 (F)" });
  await attack.click();
  await expect(attack).not.toBeFocused();

  const menu = page.getByRole("button", { name: "내 카피바라 메뉴", exact: true });
  await menu.click({ button: "right" });

  await expect(menu).not.toBeFocused();
  await page.keyboard.press("Space");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.evaluate(() => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).resolves.toBe(true);
});
