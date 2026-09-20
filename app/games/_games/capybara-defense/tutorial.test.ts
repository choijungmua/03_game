import { describe, expect, it } from "vitest";
import type { DefenseStorage } from "./persistence";
import {
  advanceTutorial,
  createTutorialState,
  parseDefenseTutorial,
  readDefenseTutorial,
  resetDefenseTutorial,
  skipTutorial,
  writeDefenseTutorial,
} from "./tutorial";

function storage(): DefenseStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe("디펜스 첫 플레이 튜토리얼", () => {
  it("뽑기·배치·합성·강화 순서대로 완료한다", () => {
    // Given
    const initial = createTutorialState();

    // When
    const completed = advanceTutorial(
      advanceTutorial(advanceTutorial(advanceTutorial(initial, "draw"), "place"), "merge"),
      "upgrade",
    );

    // Then
    expect(completed).toEqual({ completed: true, step: "upgrade" });
  });

  it("현재 단계와 다른 행동은 튜토리얼을 건너뛰지 않는다", () => {
    // Given
    const initial = createTutorialState();

    // When
    const unchanged = advanceTutorial(initial, "upgrade");

    // Then
    expect(unchanged).toEqual(initial);
  });

  it("완료 또는 건너뛰기 상태는 다시 강제되지 않고 초기화로만 돌아온다", () => {
    // Given
    const skipped = skipTutorial(createTutorialState());

    // When
    const restored = parseDefenseTutorial(JSON.stringify(skipped));
    const reset = resetDefenseTutorial();

    // Then
    expect(restored.completed).toBe(true);
    expect(reset).toEqual({ completed: false, step: "draw" });
  });

  it("완료 상태를 저장하고 명시적 초기화 때만 제거한다", () => {
    // Given
    const adapter = storage();
    const completed = skipTutorial(createTutorialState());

    // When
    writeDefenseTutorial(adapter, completed);
    const restored = readDefenseTutorial(adapter);
    resetDefenseTutorial(adapter);
    const reset = readDefenseTutorial(adapter);

    // Then
    expect(restored.completed).toBe(true);
    expect(reset).toEqual({ completed: false, step: "draw" });
  });
});
