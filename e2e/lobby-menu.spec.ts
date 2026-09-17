import { expect, test } from "./support";

test("내 카피바라 메뉴가 화면 크기에 맞춰 열리고 탭을 오간다", async ({ page }, testInfo) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "내 카피바라 메뉴", exact: true });
  await expect(trigger).toBeVisible();

  await trigger.click();

  const menu = page.getByRole("dialog", { name: "내 카피바라" });
  await expect(menu).toBeVisible();
  const tabs = menu.getByRole("tab");
  await expect(tabs).toHaveCount(4);
  for (const label of ["옷장", "가방", "소리", "이름"]) {
    await expect(menu.getByText(label, { exact: true })).toBeVisible();
  }
  // 처음 열면 옷장 탭이 바로 보인다
  await expect(menu.getByRole("tab", { name: "카피바라 옷 입히기" })).toHaveAttribute("aria-selected", "true");
  await expect(menu.getByRole("tabpanel", { name: "카피바라 옷 입히기" })).toBeVisible();
  // 열리는 애니메이션이 끝난 뒤에 찍고 잰다
  await expect(menu).toHaveCSS("opacity", "1");
  await expect(menu).toHaveCSS("translate", "none");
  await page.screenshot({ path: `artifacts/lobby-menu-${testInfo.project.name}-open.png` });

  // 탭을 바꿔도 탭 줄 자리는 그대로다
  const tablist = menu.getByRole("tablist");
  const before = await tablist.boundingBox();
  await menu.getByRole("tab", { name: "효과음 설정" }).click();
  await expect(menu.getByRole("tabpanel", { name: "효과음 설정" })).toBeVisible();
  expect(await tablist.boundingBox()).toEqual(before);
  await page.screenshot({ path: `artifacts/lobby-menu-${testInfo.project.name}-sound.png` });

  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toHaveAttribute("inert", "");
  await expect(trigger).toBeFocused();
});
