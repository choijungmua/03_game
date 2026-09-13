"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { useId } from "react";

import { cn } from "@/lib";
import { Label } from "@/components/inputs/label";
import { checkboxVariants } from "./variable";
import { CheckboxProps } from "./type";
import { SLOT, CHECKBOX_CONFIG } from "./constants";

function Checkbox({
  className,
  variant,
  size,
  rounded = "rounded-sm", // 기본값 rounded-sm으로 변경
  label,
  id,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id || generatedId;
  const isIconOnly = variant === "icon-only";

  const checkbox = (
    <CheckboxPrimitive.Root
      id={checkboxId}
      data-slot={SLOT.ROOT}
      className={cn(checkboxVariants({ variant, size }), rounded, className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot={SLOT.INDICATOR}
        forceMount={isIconOnly ? true : undefined}
        className={cn(
          "flex items-center justify-center text-current size-full",
        )}
      >
        {/* 애니메이션과 색상 상속(currentColor)을 위해 인라인 SVG 사용 */}
        <svg
          fill="none"
          viewBox="0 0 24 24"
          className={cn("size-full p-[3px]", CHECKBOX_CONFIG.animation.zoom)}
        >
          <path
            d="M4.5 12.1L8.75 16.35L19.5 5.35"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={CHECKBOX_CONFIG.animation.draw}
            style={{ strokeDasharray: 24, strokeDashoffset: 0 }}
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (label) {
    return (
      <div className="flex items-start space-x-2">
        {checkbox}
        <Label htmlFor={checkboxId} className="cursor-pointer font-normal select-none">
          {label}
        </Label>
      </div>
    );
  }

  return checkbox;
}

export { Checkbox };
