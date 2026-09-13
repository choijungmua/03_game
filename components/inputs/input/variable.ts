import { cva } from "class-variance-authority";

export const INPUT_STYLES = {
  base: "flex w-full border transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-placeholder focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-error/20",
  variant: {
    default: "bg-transparent border-border-default shadow-sm",
    filled:
      "bg-bg-neutral border-transparent focus-visible:bg-transparent focus-visible:border-primary",
    flushed:
      "!rounded-none border-0 border-b border-border-default px-0 shadow-none focus-visible:ring-0 focus-visible:border-primary bg-transparent",
  },
  size: {
    default: "h-9 px-3 py-1 text-caption-1",
    sm: "h-8 px-2 text-caption-2",
    lg: "h-10 px-4 text-caption-1",
  },
  shape: {
    default: "rounded-md",
    pill: "rounded-full px-4",
    square: "rounded-none",
  },
  icon: "absolute top-1/2 -translate-y-1/2 text-text-placeholder transition-colors flex items-center gap-1.5 [&_button]:hover:bg-transparent",
} as const;

export const inputVariants = cva(INPUT_STYLES.base, {
  variants: {
    variant: INPUT_STYLES.variant,
    size: INPUT_STYLES.size,
    shape: INPUT_STYLES.shape,
  },
  defaultVariants: {
    variant: "default",
    size: "default",
    shape: "default",
  },
});
