"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib";
import { labelVariants } from "./variable";
import { LabelProps } from "./type";
import { SLOT } from "./constants";

function Label({ className, size, required, children, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      data-slot={SLOT.ROOT}
      className={cn(labelVariants({ size }), className)}
      {...props}
    >
      {children}
      {required && <span className="text-error ml-0.5">*</span>}
    </LabelPrimitive.Root>
  );
}

export { Label };