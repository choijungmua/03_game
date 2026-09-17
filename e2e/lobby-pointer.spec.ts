import { expect, test } from "./support";

test("우클릭은 메뉴나 버튼 포커스 대신 로비 이동으로 처리된다", async ({ page }) => {
  await page.goto("/");

  const attack = page.getByRole("button", { name: "때리기 (F)" });
  await attack.click();
  await expect(attack).not.toBeFocused();

  const wardrobe = page.getByRole("button", { name: "카피바라 옷 입히기" });
  await wardrobe.click({ button: "right" });

  await expect(wardrobe).not.toBeFocused();
  await page.keyboard.press("Space");
  await expect(wardrobe).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.evaluate(() => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).resolves.toBe(true);
});
