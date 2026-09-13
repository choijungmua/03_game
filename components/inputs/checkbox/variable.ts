import { cva } from "class-variance-authority";

export const checkboxVariants = cva(
  "peer shrink-0 disabled:cursor-not-allowed disabled:opacity-50 transition-[color,background-color,border-color,box-shadow,opacity,transform]",
  {
    variants: {
      variant: {
        default:
          "border-2 border-primary shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary",
        "icon-only":
          "group flex items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-text-placeholder data-[state=checked]:text-primary hover:text-primary/50",
      },
      size: {
        default: "h-5 w-5", // 사이즈 약간 키움 (두꺼운 체크를 위해)
        sm: "h-4 w-4",
        lg: "h-6 w-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);