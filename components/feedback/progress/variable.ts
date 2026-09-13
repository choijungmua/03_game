import { cva } from "class-variance-authority";

export const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-bg-neutral",
  {
    variants: {
      size: {
        default: "h-4",
        sm: "h-2",
        lg: "h-6",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export const indicatorVariants = cva(
  "h-full w-full flex-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] bg-primary rounded-full",
  {
    variants: {},
    defaultVariants: {},
  }
);
