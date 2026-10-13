import { describe, expect, it } from "vitest";

import { SOUNDS } from "./constants";

describe("로비 효과음", () => {
  it("로비 소리엔 사람 목소리 녹음이 없다 (카피바라 울음은 합성 삑·떨림으로 낸다)", () => {
    const voiced = Object.entries(SOUNDS).filter(([, layers]) => layers.some((layer) => layer.kind === "voice"));
    expect(voiced.map(([name]) => name)).toEqual([]);
  });

  it("하품은 바르르 떨리며 내려가는 카피바라 울음이 들어 있다", () => {
    const cry = SOUNDS.yawn.find((layer) => layer.kind === "tone" && layer.vibrato);
    expect(cry).toBeDefined();
    expect(cry!.from).toBeGreaterThan(cry!.to);
  });
});
