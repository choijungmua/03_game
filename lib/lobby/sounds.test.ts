import { describe, expect, it } from "vitest";

import { SOUNDS } from "./constants";

describe("로비 효과음", () => {
  it("로비 소리엔 사람 목소리 녹음이 없다 (카피바라 울음은 합성 삑·떨림으로 낸다)", () => {
    const voiced = Object.entries(SOUNDS).filter(([, layers]) => layers.some((layer) => layer.kind === "voice"));
    expect(voiced.map(([name]) => name)).toEqual([]);
  });

  it("울음은 무섭지 않게: 짧고(0.3초 이하) 음이 위로만 가고, 어두운 '우' 모음·떨림 없이", () => {
    const cries = Object.values(SOUNDS).flat().filter((layer) => layer.kind === "cry");
    for (const cry of cries) {
      if (cry.kind !== "cry") continue;
      expect(cry.ms).toBeLessThanOrEqual(300);
      const points = [cry.from, ...(cry.via ?? []), cry.to];
      points.slice(1).forEach((hz, index) => expect(hz).toBeGreaterThan(points[index]));
      expect([cry.vowel, cry.vowelTo]).not.toContain("u");
      if (cry.vibrato) expect(cry.ms).toBeLessThanOrEqual(300);
    }
  });

  it("긁기·졸기 소리가 있다", () => {
    expect(SOUNDS.scratch.length).toBeGreaterThanOrEqual(4);
    expect(SOUNDS.doze.some((layer) => layer.kind === "cry")).toBe(true);
  });

  it("카피바라 울음은 하이톤이고 귀신 소리처럼 울리지 않게 마른 소리다", () => {
    const cries = Object.values(SOUNDS).flat().filter((layer) => layer.kind === "cry");
    expect(cries.length).toBeGreaterThan(8);
    expect(SOUNDS.yawn.filter((layer) => layer.kind === "cry").length).toBe(2);
    for (const cry of cries) {
      expect(Math.max(cry.from, cry.to)).toBeGreaterThanOrEqual(900);
      expect(cry.wet ?? 0).toBeLessThanOrEqual(0.1);
    }
  });
});
