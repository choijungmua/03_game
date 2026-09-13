import { cva } from "class-variance-authority";

export const LABEL_STYLES = {
  base: "text-caption-1 text-text-strong peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  size: {
    default: "text-caption-1",
    sm: "text-caption-2",
    lg: "text-sm",
  }
} as const;

export const labelVariants = cva(LABEL_STYLES.base, {
  variants: {
    size: LABEL_STYLES.size,
  },
  defaultVariants: {
    size: "default",
  },
});