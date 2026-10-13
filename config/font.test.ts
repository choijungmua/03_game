// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = new URL("../app/fonts/pretendard-subsets.css", import.meta.url);
const css = readFileSync(stylesheet, "utf8");

describe("self-hosted Pretendard subsets", () => {
  it("ships a valid local WOFF2 file for every declared subset", () => {
    const sources = [...css.matchAll(/src:\s*url\(([^)]+)\)/g)];
    expect(sources.length).toBeGreaterThan(0);
    for (const [, source] of sources) {
      expect(source.startsWith("./woff2-dynamic-subset/")).toBe(true);
      const font = readFileSync(new URL(source, stylesheet));
      expect(font.subarray(0, 4).toString("ascii")).toBe("wOF2");
    }
  });

  it("retains every modern Hangul syllable and printable ASCII character", () => {
    const covered = new Set<number>();
    for (const [, ranges] of css.matchAll(/unicode-range:\s*([^;]+);/g)) {
      for (const range of ranges.split(",")) {
        const [start, end = start] = range.trim().slice(2).split("-");
        for (let point = Number.parseInt(start, 16); point <= Number.parseInt(end, 16); point++) {
          covered.add(point);
        }
      }
    }
    for (let point = 0xac00; point <= 0xd7a3; point++) expect(covered.has(point)).toBe(true);
    for (let point = 0x20; point <= 0x7e; point++) expect(covered.has(point)).toBe(true);
  });
});
