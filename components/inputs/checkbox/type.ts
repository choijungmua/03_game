import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { ComponentPropsWithoutRef, ReactNode } from "react";
import { VariantProps } from "class-variance-authority";
import { checkboxVariants } from "./variable";

export interface CheckboxProps
  extends ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {
  rounded?: string; // rounded 클래스 직접 입력 (예: "rounded-full")
  label?: ReactNode; // 우측 라벨
}