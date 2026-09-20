import type { BakedFrame } from "./capybara-3d";

export type CharacterFit = {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly tilt: number;
  readonly turn: number;
  readonly neck: number;
  readonly raised: boolean;
  readonly eyes?: readonly number[];
  readonly eyeY?: number;
};

const VIEWS = {
  down: [0.5, 0.32, 0.29, 0.215, 0],
  "down-right": [0.52, 0.32, 0.27, 0.215, 0.55],
  right: [0.51, 0.32, 0.285, 0.215, 1],
  "up-right": [0.49, 0.32, 0.28, 0.215, 1.65],
  up: [0.5, 0.32, 0.25, 0.215, 2],
  "up-left": [0.51, 0.32, 0.28, 0.215, -1.65],
  left: [0.51, 0.32, 0.285, 0.215, -1],
  "down-left": [0.5, 0.32, 0.27, 0.215, -0.55],
} as const;

// Measured against the original PNG poses, in normalized image coordinates.
const POSES: Partial<Record<BakedFrame, Partial<CharacterFit>>> = {
  "walk1-down-right": { eyes: [0.5], eyeY: 0.3 },
  "walk2-down-right": { eyes: [0.5], eyeY: 0.3 },
  "idle-down": { y: 0.35, rx: 0.345, ry: 0.25, neck: 0.57 },
  "idle-right": { x: 0.53, y: 0.36, rx: 0.34, ry: 0.24, neck: 0.59 },
  "idle-up": { y: 0.35, rx: 0.365, ry: 0.25, neck: 0.56 },
  "idle-left": { x: 0.47, y: 0.36, rx: 0.34, ry: 0.24, neck: 0.59 },
  "sleep-1": { y: 0.36, rx: 0.345, ry: 0.24, neck: 0.57 },
  "sleep-2": { y: 0.36, rx: 0.345, ry: 0.24, neck: 0.57 },
  "punch-down": { y: 0.32, rx: 0.25, ry: 0.22, neck: 0.52 },
  "punch-right": { y: 0.31, rx: 0.255, ry: 0.215, neck: 0.5 },
  "punch-left": { y: 0.31, rx: 0.255, ry: 0.215, neck: 0.5 },
  "eating-1": { y: 0.325, rx: 0.28, ry: 0.23, neck: 0.53 },
  "eating-2": { y: 0.325, rx: 0.28, ry: 0.23, neck: 0.53 },
  "pick-1-down": { y: 0.64, rx: 0.255, ry: 0.17, neck: 0.8 },
  "pick-1-up": { y: 0.625, rx: 0.24, ry: 0.16, neck: 0.76 },
  "pick-2-down": { y: 0.28, rx: 0.24, ry: 0.185, neck: 0.455, raised: true },
  "pick-2-up": { y: 0.255, rx: 0.23, ry: 0.19, neck: 0.435, raised: true },
  "pick-3-down": { x: 0.425, y: 0.38, rx: 0.255, ry: 0.19, neck: 0.565, tilt: -0.43 },
  "pick-3-up": { x: 0.66, y: 0.36, rx: 0.23, ry: 0.2, neck: 0.54, tilt: 0.43 },
  "yawn-2-down": { y: 0.32, rx: 0.245, ry: 0.215, neck: 0.52, raised: true },
  "yawn-2-up": { y: 0.32, rx: 0.235, ry: 0.215, neck: 0.5, raised: true },
  "yawn-2-right": { x: 0.515, y: 0.325, rx: 0.275, ry: 0.215, neck: 0.515, tilt: -0.12, raised: true },
  "yawn-2-left": { x: 0.48, y: 0.325, rx: 0.275, ry: 0.215, neck: 0.515, tilt: 0.12, raised: true },
  "doze-1-down": { y: 0.35, rx: 0.245, ry: 0.24, neck: 0.56 },
  "doze-2-down": { y: 0.37, rx: 0.25, ry: 0.24, neck: 0.58 },
  "doze-2-right": { x: 0.55, y: 0.385, tilt: 0.2, neck: 0.58 },
  "doze-2-left": { x: 0.47, y: 0.385, tilt: -0.2, neck: 0.58 },
  "doze-1-up": { y: 0.305, ry: 0.17, neck: 0.465 },
  "doze-2-up": { y: 0.345, ry: 0.15, neck: 0.48 },
};

export function characterFit(frame: BakedFrame): CharacterFit {
  const view = Object.entries(VIEWS).sort(([a], [b]) => b.length - a.length).find(([name]) => frame.endsWith(`-${name}`))?.[1] ?? VIEWS.down;
  const [x, y, rx, ry, turn] = frame.startsWith("scratch") ? VIEWS.up : view;
  const eyes = Math.abs(turn) === 1.65 ? [x + Math.sign(turn) * 0.185] : undefined;
  return { x, y, rx, ry, turn, tilt: 0, neck: 0.515, raised: false, eyes, ...POSES[frame] };
}
