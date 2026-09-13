import { cva } from "class-variance-authority";
import { BUTTON_VARIANTS, BUTTON_SIZES, BUTTON_SHAPES } from "./constants";

export const BUTTON_STYLES = {
  base: "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px] aria-invalid:ring-error/20 aria-invalid:border-error",
  variant: {
    [BUTTON_VARIANTS.DEFAULT]:
      "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
    [BUTTON_VARIANTS.DESTRUCTIVE]:
      "bg-error text-primary-foreground hover:bg-error/90 focus-visible:ring-error/20 shadow-sm",
    [BUTTON_VARIANTS.OUTLINE]:
      "border border-border-default bg-background shadow-xs hover:bg-bg-neutral hover:text-text-strong",
    [BUTTON_VARIANTS.OUTLINE_TRANSPARENT]:
      "border border-border-default bg-transparent hover:bg-bg-neutral hover:text-text-strong",
    [BUTTON_VARIANTS.GHOST]: "hover:bg-bg-neutral hover:text-text-strong",
    [BUTTON_VARIANTS.LINK]:
      "text-primary underline-offset-4 hover:underline",
    [BUTTON_VARIANTS.BOTTOM_LINE]:
      "!rounded-none border-b border-border-default bg-transparent px-0 hover:border-primary hover:text-primary transition-colors",
  },
  size: {
    [BUTTON_SIZES.XS]:
      "h-6 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
    [BUTTON_SIZES.SM]: "h-8 px-3 has-[>svg]:px-2.5",
    [BUTTON_SIZES.DEFAULT]: "h-9 px-4 py-2 has-[>svg]:px-3",
    [BUTTON_SIZES.LG]: "h-10 px-6 has-[>svg]:px-4",
    [BUTTON_SIZES.XL]: "h-12 px-8 text-base",
  },
  shape: {
    [BUTTON_SHAPES.DEFAULT]: "rounded-md",
    [BUTTON_SHAPES.PILL]: "rounded-full",
    [BUTTON_SHAPES.SQUARE]: "rounded-none",
  },
} as const;

export const buttonVariants = cva(BUTTON_STYLES.base, {
  variants: {
    variant: BUTTON_STYLES.variant,
    size: BUTTON_STYLES.size,
    shape: BUTTON_STYLES.shape,
  },
  defaultVariants: {
    variant: BUTTON_VARIANTS.DEFAULT,
    size: BUTTON_SIZES.DEFAULT,
    shape: BUTTON_SHAPES.DEFAULT,
  },
});
