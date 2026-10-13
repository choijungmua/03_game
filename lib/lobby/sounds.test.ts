import { describe, expect, it } from "vitest";

import { SOUNDS } from "./constants";

describe("로비 효과음", () => {
  it("로비 소리엔 사람 목소리 녹음이 없다 (카피바라 울음은 합성 삑·떨림으로 낸다)", () => {
    const voiced = Object.entries(SOUNDS).filter(([, layers]) => layers.some((layer) => layer.kind === "voice"));
    expect(voiced.map(([name]) => name)).toEqual([]);
  });

  it("하품은 목소리 같은 울음이 높게 시작해 내려갔다가 끝을 다시 올린다", () => {
    const cry = SOUNDS.yawn.find((layer) => layer.kind === "cry" && layer.via);
    expect(cry).toBeDefined();
    if (cry?.kind !== "cry" || !cry.via) return;
    expect(cry.from).toBeGreaterThanOrEqual(900);
    expect(cry.to).toBeGreaterThan(Math.min(...cry.via));
  });

  it("긁기·졸기 소리가 있다", () => {
    expect(SOUNDS.scratch.length).toBeGreaterThanOrEqual(4);
    expect(SOUNDS.doze.some((layer) => layer.kind === "cry")).toBe(true);
  });

  it("카피바라 울음은 하이톤이고 귀신 소리처럼 울리지 않게 마른 소리다", () => {
    const cries = Object.values(SOUNDS).flat().filter((layer) => layer.kind === "cry");
    expect(cries.length).toBeGreaterThan(8);
    for (const cry of cries) {
      expect(Math.max(cry.from, cry.to)).toBeGreaterThanOrEqual(900);
      expect(cry.wet ?? 0).toBeLessThanOrEqual(0.1);
    }
  });
});
