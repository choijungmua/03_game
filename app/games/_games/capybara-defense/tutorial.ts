import type { DefenseStorage } from "./persistence";

export const DEFENSE_TUTORIAL_KEY = "capybara-defense.tutorial";
export type TutorialStep = "draw" | "place" | "merge" | "upgrade";
export type TutorialState = Readonly<{ completed: boolean; step: TutorialStep }>;

const STEPS: readonly TutorialStep[] = ["draw", "place", "merge", "upgrade"];

function isTutorialStep(value: unknown): value is TutorialStep {
  return value === "draw" || value === "place" || value === "merge" || value === "upgrade";
}

export function createTutorialState(): TutorialState {
  return Object.freeze({ completed: false, step: "draw" });
}

export function advanceTutorial(state: TutorialState, action: TutorialStep): TutorialState {
  if (state.completed || action !== state.step) return state;
  const index = STEPS.indexOf(state.step);
  const next = STEPS[index + 1];
  return next === undefined
    ? Object.freeze({ completed: true, step: "upgrade" })
    : Object.freeze({ completed: false, step: next });
}

export function skipTutorial(state: TutorialState): TutorialState {
  return state.completed ? state : Object.freeze({ completed: true, step: state.step });
}

export function parseDefenseTutorial(raw: string | null): TutorialState {
  if (raw === null) return createTutorialState();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) return createTutorialState();
    throw error;
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 2 ||
    !("completed" in value) ||
    !("step" in value) ||
    typeof value.completed !== "boolean" ||
    !isTutorialStep(value.step)
  ) {
    return createTutorialState();
  }
  return Object.freeze({ completed: value.completed, step: value.step });
}

export function readDefenseTutorial(storage: DefenseStorage): TutorialState {
  return parseDefenseTutorial(storage.getItem(DEFENSE_TUTORIAL_KEY));
}

export function writeDefenseTutorial(storage: DefenseStorage, state: TutorialState): void {
  storage.setItem(DEFENSE_TUTORIAL_KEY, JSON.stringify(state));
}

export function resetDefenseTutorial(storage?: DefenseStorage): TutorialState {
  storage?.removeItem(DEFENSE_TUTORIAL_KEY);
  return createTutorialState();
}
