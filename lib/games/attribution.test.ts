import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => { vi.resetModules(); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); history.replaceState(null, "", "/"); });

it("검색 유입 뒤 내부 링크로 게임에 가거나 새로고침해도 최초 경로와 UTM을 보존한다", async () => {
  history.replaceState(null, "", "/capybara?utm_source=naver&utm_medium=search&utm_campaign=animals");
  vi.spyOn(document, "referrer", "get").mockReturnValue("https://search.naver.com/search.naver");
  const { captureAttribution } = await import("./attribution");
  const first = captureAttribution();
  history.replaceState(null, "", "/games/capybara-run");
  expect(captureAttribution()).toEqual(first);
  vi.resetModules();
  const reloaded = await import("./attribution");
  expect(reloaded.captureAttribution()).toEqual({
    landingPath: "/capybara", referrerDomain: "search.naver.com",
    utmSource: "naver", utmMedium: "search", utmCampaign: "animals",
  });
});

it("저장소 접근이 막혀도 메모리에서 유입 정보를 유지한다", async () => {
  history.replaceState(null, "", "/games?utm_source=google");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
  const { captureAttribution } = await import("./attribution");
  expect(captureAttribution().utmSource).toBe("google");
  history.replaceState(null, "", "/games/capybara-run");
  expect(captureAttribution().landingPath).toBe("/games");
});
