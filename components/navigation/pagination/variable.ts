import { SIZE } from "./constants";

export const PAGINATION_STYLES = {
  nav: "mx-auto flex w-full justify-center",
  content: "flex flex-row items-center gap-1",
  item: "",
  link: {
    base: "inline-flex items-center justify-center rounded-md font-medium transition-colors",
    active: "pointer-events-none text-text-disabled",
    inactive: "hover:bg-accent hover:text-accent-foreground",
  },
  ellipsis: {
    base: "flex items-center justify-center",
    size: {
      [SIZE.SM]: "size-7",
      [SIZE.DEFAULT]: "size-9",
      [SIZE.LG]: "size-11",
    },
  },
  navigation: {
    base: "gap-1",
    size: {
      [SIZE.SM]: "px-2",
      [SIZE.DEFAULT]: "px-2.5",
      [SIZE.LG]: "px-3",
    },
  },
  icon: {
    size: {
      [SIZE.SM]: "size-3",
      [SIZE.DEFAULT]: "size-4",
      [SIZE.LG]: "size-5",
    },
  },
} as const;
