import { cn } from "@/lib";
import { skeletonVariants } from "./variable";
import { SkeletonProps } from "./type";
import { SLOT, DEFAULT } from "./constants";

function Skeleton({ className, variant = DEFAULT.VARIANT, ...props }: SkeletonProps) {
  return (
    <div
      data-slot={SLOT.ROOT}
      className={cn(skeletonVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Skeleton };