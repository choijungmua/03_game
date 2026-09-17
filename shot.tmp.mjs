import { chromium } from "@playwright/test";
const out = process.argv[2];
const spots = JSON.parse(process.argv[3]);
const b = await chromium.launch();
for (const [name, x, y, w = 1600, h = 1000] of spots) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([x, y]) => sessionStorage.setItem("lobby-position-v3", JSON.stringify({ x, y })), [x, y]);
  const p = await ctx.newPage();
  await p.goto("http://localhost:3847/", { waitUntil: "load", timeout: 240000 });
  await p.waitForFunction(() => !document.body.innerText.includes("로비 불러오는 중"), null, { timeout: 180000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}/${name}.png` });
  await ctx.close();
}
await b.close();
console.log("done");
