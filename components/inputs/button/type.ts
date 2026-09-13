import type { ComponentProps, ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "./variable";

export interface ButtonProps
  extends ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isLoading?: boolean;
  isIcon?: boolean; // 아이콘 버튼 모드 (정방형, 패딩 없음)
}
