import { cva } from "class-variance-authority"

export const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border border-transparent font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px] aria-invalid:ring-error/20 aria-invalid:border-error transition-[color,box-shadow] overflow-hidden cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "bg-primary/80 text-primary-foreground hover:bg-primary",
        destructive:
          "bg-error text-primary-foreground hover:bg-error/90 focus-visible:ring-error/20",
        warning: "bg-warning text-text-strong hover:bg-warning/90",
        success: "bg-success text-primary-foreground hover:bg-success/90",
        outline:
          "border-border-default text-foreground hover:bg-bg-neutral hover:text-text-strong",
        ghost: "hover:bg-bg-neutral hover:text-text-strong",
        link: "text-primary underline-offset-4 hover:underline",
        card: "bg-card text-text-strong border-border-default hover:bg-bg-neutral",
        custom: "",
      },
      size: {
        sm: "h-5 px-2 text-caption-3 [&>svg]:size-2.5 gap-1",
        default: "h-6 px-2.5 text-caption-2 [&>svg]:size-3 gap-1.5",
        lg: "h-7 px-3 text-caption-1 [&>svg]:size-3.5 gap-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
