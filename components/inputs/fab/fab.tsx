"use client";

import { cn } from "@/lib";
import { Button } from "@/components";
import { FabProps } from "./type";
import { FAB_STYLES } from "./variable";
import { SLOT, DEFAULT } from "./constants";

export function Fab({
  ref,
  className,
  variant = DEFAULT.VARIANT,
  size = DEFAULT.SIZE,
  position = DEFAULT.POSITION,
  ...props
}: FabProps) {
  return (
    <div
      className={cn(FAB_STYLES.wrapper, FAB_STYLES.position[position])}
      ref={ref}
    >
      <Button
        data-slot={SLOT.ROOT}
        variant={variant}
        size={size}
        isIcon
        className={cn(FAB_STYLES.base, className)}
        {...props}
      />
    </div>
  );
}
