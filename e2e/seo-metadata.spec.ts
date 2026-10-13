import { expect, test } from "./support";

for (const path of ["/capybara", "/games/capybara-run/guide", "/about", "/guestbook"]) {
  test(`${path} 공유 이미지가 페이지에 맞게 렌더링된다`, async ({ page }) => {
    await page.goto(path);
    const imagePath = path === "/guestbook" ? "/opengraph-image" : `${path}/opengraph-image`;

    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      const image = page.locator(selector);
      await expect(image).toHaveCount(1);
      const content = await image.getAttribute("content");
      expect(content).not.toBeNull();
      if (content === null) throw new TypeError("공유 이미지 URL이 없습니다");
      expect(new URL(content).pathname).toBe(imagePath);
    }
  });
}
