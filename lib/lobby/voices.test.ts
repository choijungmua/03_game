import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { VOICE_LINES } from "./settings";

describe("카피바라 목소리 파일", () => {
  it("대사마다 public/sfx/voice에 파일이 있고, 한 번에 받아도 가볍다", () => {
    let total = 0;
    for (const line of VOICE_LINES) {
      const file = join(process.cwd(), "public", "sfx", "voice", `${line}.wav`);
      expect(existsSync(file), line).toBe(true);
      total += statSync(file).size;
    }
    expect(total).toBeLessThan(600_000);
  });
});
