export const SLOT = {
  ROOT: "carousel",
  CONTENT: "carousel-content",
  ITEM: "carousel-item",
  NEXT: "carousel-next",
  PREVIOUS: "carousel-previous",
} as const;

export const ORIENTATION = {
  HORIZONTAL: "horizontal",
  VERTICAL: "vertical",
} as const;

export const BASIC_STYLES = {
  BUTTON_VARIANT: "ghost",
  BUTTON_SIZE: "icon",
  HORIZONTAL_BUTTON_PREVIOUS: "top-1/2 -left-12 -translate-y-1/2",
  HORIZONTAL_BUTTON_NEXT: "top-1/2 -right-12 -translate-y-1/2",
  VERTICAL_BUTTON_PREVIOUS: "-top-12 left-1/2 -translate-x-1/2 rotate-90",
  VERTICAL_BUTTON_NEXT: "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
} as const;

export type Orientation = (typeof ORIENTATION)[keyof typeof ORIENTATION];