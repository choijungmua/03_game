export const SIZE = {
  DEFAULT: "default",
  SM: "sm",
  LG: "lg",
} as const;

export type Size = (typeof SIZE)[keyof typeof SIZE];

export const AVATAR_SIZE = {
  root: "data-[size=lg]:size-10 data-[size=sm]:size-6",
  fallback: "group-data-[size=sm]:text-caption-3",
  badge:
    "group-data-[size=sm]:size-2 group-data-[size=sm]:[&>svg]:hidden group-data-[size=default]:size-2.5 group-data-[size=default]:[&>svg]:size-2 group-data-[size=lg]:size-3 group-data-[size=lg]:[&>svg]:size-2",
  groupCount:
    "group-has-data-[size=lg]:size-10 group-has-data-[size=sm]:size-6 group-has-data-[size=lg]:[&>svg]:size-5 group-has-data-[size=sm]:[&>svg]:size-3",
} as const;

export const SLOT = {
    BADGE: "avatar-badge",
    FALLBACK: "avatar-fallback",
    GROUP_COUNT: "avatar-group-count",
    GROUP: "avatar-group",
    IMAGE: "avatar-image",
    ROOT: "avatar",
} as const;