import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LOBBY_CHARACTER_BASE } from "./character-style";

describe("LOBBY_CHARACTER_BASE", () => {
  it("uses the plush PNG character set with all eight camera-relative facings", () => {
    const facings = ["up", "up-right", "right", "down-right", "down", "down-left", "left", "up-left"];

    const filesExist = facings.every((facing) =>
      existsSync(join(process.cwd(), "public", LOBBY_CHARACTER_BASE, `capybara-stand-${facing}.webp`)),
    );

    expect(filesExist).toBe(true);
  });
});
