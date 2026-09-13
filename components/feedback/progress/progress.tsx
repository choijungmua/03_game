"use client";

import * as React from "react";
import { cn } from "@/lib";
import { ProgressProps } from "./type";
import { progressVariants, indicatorVariants } from "./variable";
import { SLOT, ROLE } from "./constants";

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, size, ...props }, ref) => (
    <div
      ref={ref}
      data-slot={SLOT.ROOT}
      role={ROLE.PROGRESSBAR}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn(progressVariants({ size }), className)}
      {...props}
    >
      <div
        data-slot={SLOT.INDICATOR}
        className={cn(indicatorVariants())}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </div>
  )
);
Progress.displayName = "Progress";

export { Progress };