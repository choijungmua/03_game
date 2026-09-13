export const SLOT = {
  ROOT: "tabs",
  LIST: "tabs-list",
  TRIGGER: "tabs-trigger",
  CONTENT: "tabs-content",
} as const;

export const VARIANT = {
  DEFAULT: "default",
  LINE: "line",
} as const;

export const SIZE = {
  SM: "sm",
  DEFAULT: "default",
  LG: "lg",
} as const;

export const ORIENTATION = {
  HORIZONTAL: "horizontal",
  VERTICAL: "vertical",
} as const;

export const DEFAULT = {
  VARIANT: VARIANT.DEFAULT,
  SIZE: SIZE.DEFAULT,
  ORIENTATION: ORIENTATION.HORIZONTAL,
} as const;
