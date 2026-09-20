import type { BakedFrame } from "./capybara-3d";

const POSE_SCALE: Partial<Record<BakedFrame, number>> = {
  "idle-down": 0.8,
  "idle-right": 0.8,
  "idle-up": 0.72,
  "idle-left": 0.8,
  "sleep-1": 0.8,
  "sleep-2": 0.8,
};

export function characterBaseBounds(
  frame: BakedFrame,
  [left, top, size]: readonly [number, number, number],
): readonly [number, number, number] {
  const scaled = size * (POSE_SCALE[frame] ?? 1);
  return [left + (size - scaled) / 2, top + (size - scaled) * (1000 / 1024), scaled];
}
