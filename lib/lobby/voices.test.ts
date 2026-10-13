import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FX_SAMPLES, VOICE_LINES } from "./settings";

describe("녹음 소리 파일 (카피바라 중얼거림·CC0 효과음)", () => {
  it("이름마다 public/sfx에 파일이 있고, 한 번에 받아도 가볍다", () => {
    let total = 0;
    const files = [...VOICE_LINES.map((line) => ["voice", line]), ...FX_SAMPLES.map((name) => ["fx", name])];
    for (const [dir, name] of files) {
      const file = join(process.cwd(), "public", "sfx", dir, `${name}.wav`);
      expect(existsSync(file), name).toBe(true);
      total += statSync(file).size;
    }
    expect(total).toBeLessThan(800_000);
  });
});
