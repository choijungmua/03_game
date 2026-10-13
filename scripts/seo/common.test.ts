// @vitest-environment node
import { describe, expect, it } from "vitest";

import { shouldGenerateSeo } from "./common";

describe("SEO 생성 대상 선택", () => {
  it.each([
    { args: ["--stale", "--missing"], hasSeo: false, stale: false, expected: true },
    { args: ["--stale", "--missing"], hasSeo: true, stale: true, expected: true },
    { args: ["--stale", "--missing"], hasSeo: true, stale: false, expected: false },
    { args: ["--missing"], hasSeo: true, stale: true, expected: false },
    { args: ["--missing"], hasSeo: false, stale: false, expected: true },
    { args: ["--stale"], hasSeo: false, stale: false, expected: false },
    { args: ["--stale"], hasSeo: true, stale: true, expected: true },
    { args: ["--all"], hasSeo: true, stale: false, expected: true },
    { args: ["capybara-run"], hasSeo: false, stale: false, expected: true },
  ])("$args / existing=$hasSeo / stale=$stale selects $expected", ({ args, hasSeo, stale, expected }) => {
    const selected = shouldGenerateSeo(args, hasSeo, stale);

    expect(selected).toBe(expected);
  });
});
