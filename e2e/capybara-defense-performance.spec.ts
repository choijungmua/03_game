import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./support";

const EVIDENCE = path.resolve(process.cwd(), process.env.DEFENSE_EVIDENCE_DIR ?? ".omo/evidence/defense-full/browser/resume/e2e");
const ADS = /(adsbygoogle|doubleclick|googlesyndication|googleadservices|adservice)/i;
const CELLS = [0, 1, 2, 3, 4, 5, 11, 17, 23, 22, 21, 20, 19, 18, 12, 6, 7, 8, 9, 10, 13, 14, 15, 16];
const CLASSES = ["전사", "궁수", "마법사"];

declare global {
  interface Window {
    __DEFENSE_MEASURE__: { frames: number[]; hudChanges: number; inputStarted: number | null; inputLatencyMs: number | null };
    __DEFENSE_LEGACY_READS__: string[];
    __DEFENSE_OBSERVED_ROUNDS__: number[];
  }
}

async function record(page: Page, name: string, details: unknown) {
  await mkdir(EVIDENCE, { recursive: true });
  await writeFile(path.join(EVIDENCE, `${name}.json`), JSON.stringify(details, null, 2));
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), fullPage: true });
}

test("completes rounds 1 through 120 using current economy controls and supported speed", async ({ page, errors }, info) => {
  test.setTimeout(900_000);
  page.setDefaultTimeout(10_000);
  const adRequests: string[] = [];
  page.on("request", request => { if (ADS.test(request.url())) adRequests.push(request.url()); });
  await page.goto("/games/capybara-defense", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__DEFENSE_OBSERVED_ROUNDS__ = [];
    const hud = document.querySelector('[data-testid="round"]');
    const observe = () => {
      const round = Number.parseInt(hud?.textContent ?? "0", 10);
      if (round > 0 && !window.__DEFENSE_OBSERVED_ROUNDS__.includes(round)) window.__DEFENSE_OBSERVED_ROUNDS__.push(round);
    };
    observe();
    if (hud) new MutationObserver(observe).observe(hud, { childList: true, characterData: true, subtree: true });
  });
  await page.getByRole("button", { name: "수비 시작", exact: true }).click();
  console.log("full-run: started");
  const game = page.locator('section[aria-label="카피바라 디펜스"]');
  const roster = page.locator('[aria-label="수비대 목록"] button');
  const tiers = ["일반", "레어", "고대", "유물", "서사", "전설", "에픽", "신화", "태초", "종말"];
  const units = () => roster.evaluateAll(elements => elements.map(element => ({ id: Number(element.getAttribute("data-unit-id")), text: element.textContent ?? "" })));
  const rank = (text: string) => tiers.findIndex(tier => text.endsWith(tier));
  const targetEnemy = async (id: string) => {
    try {
      await page.locator('select[name="enemy"]').selectOption(id, { timeout: 500 });
      return true;
    } catch (error) {
      if (!await page.locator('select[name="enemy"] option[value="' + id + '"]').count()) return false;
      throw error;
    }
  };
  const close = async () => { if (await page.getByRole("dialog").count()) { await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toBeHidden(); } };
  const open = async (name: RegExp) => { await close(); await page.getByRole("button", { name }).click(); await expect(page.getByRole("dialog")).toBeVisible(); };
  const place = async (id: number) => {
    await close(); await page.locator('[aria-label="수비대 목록"] button[data-unit-id="' + id + '"]').click();
    await open(/^명령 ·/); await page.locator('input[name="x"]').fill(String(130 + id % 4 * 80)); await page.locator('input[name="y"]').fill("90");
    await page.getByRole("button", { name: "선택 부대 이동", exact: true }).click(); await close();
  };
  const actions: unknown[] = [];
  const positioned = new Set<number>();
  let slowedForFinalWaves = false;
  const rounds = new Set<number>();
  for (let second = 0; second < 780; second += 1) {
    const phase = await game.getAttribute("data-phase");
    const round = Number.parseInt(await page.getByTestId("round").innerText(), 10);
    rounds.add(round);
    if (second % 10 === 0) console.log(`full-run: tick ${second}, round ${round}, phase ${phase}`);
    if (phase !== "playing") break;
    try {
      if (round >= 90 && !slowedForFinalWaves) { await close(); await page.getByRole("button", { name: "1배속", exact: true }).click(); slowedForFinalWaves = true; }
      await close(); const convert = page.getByRole("button", { name: "가스 모두 전환", exact: true }); if (await convert.isEnabled()) await convert.click();
      await open(/^컬렉션(?: · 등록 \d+)?$/);
      const registrationNames = await page.getByRole("dialog").getByRole("button", { name: / 등록$/ }).allTextContents();
      for (const name of registrationNames) {
        const registration = page.getByRole("dialog").getByRole("button", { name, exact: true });
        if (await registration.isEnabled()) await registration.click();
      }
      await open(/^자원 ·/);
      while (await page.getByRole("button", { name: "전사 선택", exact: true }).count()) {
        let owned = await units();
        if (owned.length === 24) {
          const sellable = [...owned].sort((a, b) => rank(a.text) - rank(b.text)).find(unit => rank(unit.text) < 5);
          if (!sellable) break;
          await close(); await page.locator('[aria-label="수비대 목록"] button[data-unit-id="' + sellable.id + '"]').click();
          await page.getByRole("button", { name: /^판매/ }).click(); await page.getByRole("button", { name: "판매 확정", exact: true }).click();
          await expect(page.getByRole("dialog")).toBeHidden(); await open(/^자원 ·/); owned = await units();
        }
        const ticketTier = (await page.getByRole("dialog").innerText()).match(/(일반|레어|고대|유물|서사|전설|에픽|신화|태초|종말) 선택권 #/)?.[1] ?? "일반";
        const choice = [...CLASSES].sort((a, b) => owned.filter(unit => unit.text.startsWith(a) && rank(unit.text) >= tiers.indexOf(ticketTier)).length - owned.filter(unit => unit.text.startsWith(b) && rank(unit.text) >= tiers.indexOf(ticketTier)).length)[0];
        await page.getByRole("button", { name: choice + " 선택", exact: true }).first().click();
      }
      await close(); for (const unit of (await units()).filter(unit => !positioned.has(unit.id))) { await place(unit.id); positioned.add(unit.id); }
      while (await roster.count() < 22 && await page.getByRole("button", { name: /랜덤 소환/ }).isEnabled()) {
        await page.getByRole("button", { name: /랜덤 소환/ }).click(); const newest = (await units()).at(-1); if (newest) { await place(newest.id); positioned.add(newest.id); }
      }
      await open(/^자원 ·/);
      for (let upgrade = 0; upgrade < 60; upgrade += 1) {
        const choices = await page.getByRole("dialog").getByRole("button", { name: /^(전사|궁수|마법사) \+/ }).all();
        const levels = await Promise.all(choices.map(async button => ({ button, level: Number((await button.innerText()).match(/\+(\d+)/)?.[1] ?? 20) })));
        levels.sort((a, b) => a.level - b.level); const next = levels[0]; if (!next || !await next.button.isEnabled()) break; await next.button.click();
      }
      await close();
      if (round >= 50) {
        await open(/^명령 ·/);
        const bosses = await page.locator('select[name="enemy"] option').evaluateAll(options => options.filter(option => /심연의 군주|쌍둥이 수호자|수정 여왕|늪지 파수꾼/.test(option.textContent ?? "")).map(option => ({ value: (option as HTMLOptionElement).value, name: option.textContent })));
        if (bosses.length) {
          await page.getByRole("button", { name: "전체 선택", exact: true }).click();
          if (await targetEnemy(bosses[0].value) && await page.getByRole("button", { name: "집중 공격", exact: true }).isEnabled()) await page.getByRole("button", { name: "집중 공격", exact: true }).press("Enter");
          await close();
          for (const className of ["마법사", "전사", "궁수"]) {
            const caster = (await units()).filter(unit => unit.text.startsWith(className) && rank(unit.text) >= 6).sort((a, b) => rank(b.text) - rank(a.text))[0];
            if (!caster) continue;
            await page.locator('[aria-label="수비대 목록"] button[data-unit-id="' + caster.id + '"]').click();
            await open(/^명령 ·/);
            const target = page.locator('select[name="enemy"] option[value="' + bosses[0].value + '"]');
            if (await target.count() && await targetEnemy(bosses[0].value)) {
              const ability = page.getByRole("button", { name: /^(EMP|락다운|인스네어) 사용$/ });
              if (await ability.isEnabled()) await ability.press("Enter");
            }
            await close();
          }
        }
        await close();
      }
      actions.push({ second, round, gold: await page.getByTestId("gold").innerText(), units: await units() });
    } catch (error) {
      console.log("full-run action error", String(error));
      if (await game.getAttribute("data-phase") === "playing") throw error;
    }
    if (second === 3) await page.getByRole("button", { name: "2배속", exact: true }).click();
    await page.waitForTimeout(1000);
  }
  const phase = await game.getAttribute("data-phase");
  await close();
  await record(page, `full-run-${info.project.name}`, { scenario: "normal RNG, public economy/placement/focus/ability controls, actual timers, 2x then 1x from round 90", phase, rounds: [...rounds], actions, adRequests, errors });
  expect(phase).toBe("won");
  const observedRounds = await page.evaluate(() => window.__DEFENSE_OBSERVED_ROUNDS__);
  expect(observedRounds).toEqual(Array.from({ length: 120 }, (_, index) => index + 1));
  expect(adRequests).toEqual([]);
  await expect(page.locator("ins.adsbygoogle, [data-ad-slot]")).toHaveCount(0);
  await page.waitForTimeout(10_000);
  await expect(game).toHaveAttribute("data-phase", "won");
  await expect(page.getByTestId("round")).toHaveText("120 / 120");
  await page.getByRole("button", { name: "다시 도전" }).click();
  await expect(game).toHaveAttribute("data-phase", "playing");
  await expect(page.getByTestId("round")).toHaveText("1 / 120");
  await expect(page.getByTestId("gold")).toHaveText("120");
  await expect(page.getByTestId("gas")).toHaveText("0");
  await expect(roster).toHaveCount(0);
});

test("leaves legacy save and recovery bytes untouched and unread", async ({ page }, info) => {
  await page.addInitScript(() => {
    const keys = ["capybara-defense.save", "capybara-defense.save.recovery"];
    for (const key of keys) localStorage.setItem(key, `legacy sentinel ${key}`);
    window.__DEFENSE_LEGACY_READS__ = [];
    const read = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (keys.includes(key)) window.__DEFENSE_LEGACY_READS__.push(key);
      return read.call(this, key);
    };
  });
  await page.goto("/games/capybara-defense", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "수비 시작", exact: true }).click();
  await page.getByRole("button", { name: /랜덤 소환/ }).click();
  await page.locator('[data-cell="0"]').click();
  const legacy = await page.evaluate(() => ({ reads: [...window.__DEFENSE_LEGACY_READS__], save: localStorage.getItem("capybara-defense.save"), recovery: localStorage.getItem("capybara-defense.save.recovery") }));
  await record(page, `legacy-save-${info.project.name}`, { scenario: "sentinel legacy bytes before mount, then start/summon/place", ...legacy });
  expect(legacy.reads).toEqual([]);
  expect(legacy.save).toBe("legacy sentinel capybara-defense.save");
  expect(legacy.recovery).toBe("legacy sentinel capybara-defense.save.recovery");
});

test("pauses combat and loses without spending, then retries", async ({ page, errors }, info) => {
  test.setTimeout(120_000);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.goto("/games/capybara-defense", { waitUntil: "networkidle" });
  await page.clock.pauseAt(new Date("2026-01-02T00:00:00Z"));
  await page.getByRole("button", { name: "수비 시작", exact: true }).click();
  await page.getByRole("button", { name: "4배속", exact: true }).click();
  await page.clock.runFor(5000);
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  const before = await page.locator('header[aria-label="전투 현황"]').innerText();
  await page.clock.runFor(60_000);
  expect(await page.locator('header[aria-label="전투 현황"]').innerText()).toBe(before);
  await page.getByRole("button", { name: "이어하기", exact: true }).click();
  await page.clock.runFor(60_000);
  const game = page.getByRole("region", { name: "카피바라 디펜스", exact: true });
  await expect(game).toHaveAttribute("data-phase", "lost");
  await record(page, `loss-pause-${info.project.name}`, { scenario: "no purchases, pause 60s freezes HUD, resume reaches natural defeat", before, phase: await game.getAttribute("data-phase"), errors });
  await page.getByRole("button", { name: "다시 도전" }).click();
  await expect(page.getByTestId("gold")).toHaveText("120");
  await expect(game).toHaveAttribute("data-phase", "playing");
});

test("keeps live combat frame, memory, input and HUD budgets bounded without ads", async ({ page, errors }, info) => {
  test.setTimeout(120_000);
  const adRequests: string[] = [];
  page.on("request", request => { if (ADS.test(request.url())) adRequests.push(request.url()); });
  const cdp = await page.context().newCDPSession(page);
  const throttle = info.project.name === "mobile" ? 4 : 2;
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await page.goto("/games/capybara-defense", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "수비 시작", exact: true }).click();
  let placed = 0;
  await page.evaluate(() => {
    window.__DEFENSE_MEASURE__ = { frames: [], hudChanges: 0, inputStarted: null, inputLatencyMs: null };
    let previous = performance.now();
    const frame = (now: number) => {
      window.__DEFENSE_MEASURE__.frames.push(now - previous);
      previous = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const hud = document.querySelector('header[aria-label="전투 현황"]');
    if (hud) new MutationObserver(() => { window.__DEFENSE_MEASURE__.hudChanges += 1; }).observe(hud, { childList: true, characterData: true, subtree: true });
  });
  const heapBefore = await cdp.send("Runtime.getHeapUsage");
  const began = Date.now();
  while (Date.now() - began < 60_000) {
    const summon = page.getByRole("button", { name: /랜덤 소환/ });
    while (placed < CELLS.length && await summon.isEnabled()) {
      await summon.click();
      await page.locator(`[data-cell="${CELLS[placed]}"]`).click();
      placed += 1;
    }
    await page.waitForTimeout(1000);
  }
  const heapAfter = await cdp.send("Runtime.getHeapUsage");
  await page.getByRole("button", { name: "일시정지", exact: true }).evaluate(button => {
    button.addEventListener("pointerup", () => { window.__DEFENSE_MEASURE__.inputStarted = performance.now(); }, { once: true });
    const game = button.closest("section[data-phase]");
    if (game) {
      const observer = new MutationObserver(() => {
        if (game.getAttribute("data-phase") === "paused" && window.__DEFENSE_MEASURE__.inputStarted !== null) {
          window.__DEFENSE_MEASURE__.inputLatencyMs = performance.now() - window.__DEFENSE_MEASURE__.inputStarted;
          observer.disconnect();
        }
      });
      observer.observe(game, { attributes: true, attributeFilter: ["data-phase"] });
    }
  });
  const inputStart = Date.now();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await expect(page.getByRole("button", { name: "이어하기", exact: true })).toBeVisible();
  const driverRoundTripMs = Date.now() - inputStart;
  const metrics = await page.evaluate(() => ({ ...window.__DEFENSE_MEASURE__, adsInDom: document.querySelectorAll("ins.adsbygoogle, [data-ad-slot]").length, assetBytes: performance.getEntriesByType("resource").reduce((sum, entry) => sum + (entry instanceof PerformanceResourceTiming ? entry.encodedBodySize : 0), 0) }));
  const sorted = [...metrics.frames].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? Infinity;
  const heapGrowth = heapAfter.usedSize - heapBefore.usedSize;
  await record(page, `performance-${info.project.name}`, { scenario: "60s actual combat, normal summons and placements; pointerup-to-paused DOM latency measured inside browser", throttle, measuredMs: Date.now() - began, placed, p95, heapGrowth, driverRoundTripMs, ...metrics, adRequests, errors });
  expect(metrics.frames.length).toBeGreaterThan(100);
  expect(p95).toBeLessThanOrEqual(info.project.name === "mobile" ? 55 : 34);
  expect(heapGrowth).toBeLessThanOrEqual(24 * 1024 * 1024);
  expect(metrics.assetBytes).toBeLessThanOrEqual(6 * 1024 * 1024);
  expect(metrics.hudChanges / 60).toBeLessThanOrEqual(8);
  expect(metrics.inputLatencyMs ?? Infinity).toBeLessThanOrEqual(250);
  expect(metrics.adsInDom).toBe(0);
  expect(adRequests).toEqual([]);
});
