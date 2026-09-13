export const SLOT = {
  ROOT: "pagination",
  CONTENT: "pagination-content",
  ITEM: "pagination-item",
  LINK: "pagination-link",
  ELLIPSIS: "pagination-ellipsis",
  NEXT: "pagination-next",
  PREVIOUS: "pagination-previous",
} as const;

export const SIZE = {
  SM: "sm",
  DEFAULT: "default",
  LG: "lg",
} as const;

export const DEFAULT = {
  ROLE: "navigation",
  ARIA_LABEL: "pagination",
  PREVIOUS_LABEL: "Go to previous page",
  PREVIOUS_TEXT: "Previous",
  NEXT_LABEL: "Go to next page",
  NEXT_TEXT: "Next",
  ELLIPSIS_LABEL: "More pages",
  SIZE: SIZE.DEFAULT,
} as const;