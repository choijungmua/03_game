import { cva } from "class-variance-authority";
import { SIZE, VARIANT } from "./constants";

export const tabsListVariants = cva(
  "rounded-lg p-[3px] data-[variant=line]:rounded-none group/tabs-list text-text-caption inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        [VARIANT.DEFAULT]: "bg-bg-neutral",
        [VARIANT.LINE]: "gap-1 bg-transparent p-0",
      },
      size: {
        [SIZE.SM]: "group-data-[orientation=horizontal]/tabs:h-8",
        [SIZE.DEFAULT]: "group-data-[orientation=horizontal]/tabs:h-9",
        [SIZE.LG]: "group-data-[orientation=horizontal]/tabs:h-10",
      },
    },
    defaultVariants: {
      variant: VARIANT.DEFAULT,
      size: SIZE.DEFAULT,
    },
  }
);

export const TABS_STYLES = {
  root: "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
  list: {
    base: "p-[3px] group/tabs-list text-text-caption inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
    variant: {
      [VARIANT.DEFAULT]: "",
      [VARIANT.LINE]: "rounded-none gap-1 bg-transparent p-0 border-b border-border-default",
    },
    size: {
      [SIZE.SM]: "group-data-[orientation=horizontal]/tabs:h-8",
      [SIZE.DEFAULT]: "group-data-[orientation=horizontal]/tabs:h-9",
      [SIZE.LG]: "group-data-[orientation=horizontal]/tabs:h-10",
    },
  },
  trigger: {
    base: "focus-visible:border-ring focus-visible:ring-ring/50 text-text-alternative hover:text-text-strong relative inline-flex h-full flex-1 items-center justify-center gap-1.5 border border-transparent px-2 py-1 font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,transform] group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 rounded-md data-[state=active]:bg-background data-[state=active]:text-text-strong data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:shadow-none group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:text-primary group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-b-transparent group-data-[variant=line]/tabs-list:data-[state=active]:border-b-current group-data-[variant=line]/tabs-list:mb-[-1px]",
    size: {
      [SIZE.SM]: "text-xs px-2 [&_svg:not([class*='size-'])]:size-3",
      [SIZE.DEFAULT]: "text-sm px-3 [&_svg:not([class*='size-'])]:size-4",
      [SIZE.LG]: "text-base px-4 [&_svg:not([class*='size-'])]:size-5",
    },
  },
  content: "flex-1 outline-none",
} as const;
