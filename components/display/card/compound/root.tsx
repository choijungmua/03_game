import { cn } from "@/lib";
import { CARD_STYLES } from "../variable";
import { CardProps } from "../type";
import { SLOT } from "../constants";

export function Root({ className, ...props }: CardProps) {
  return (
    <div
      data-slot={SLOT.ROOT}
      className={cn(CARD_STYLES.root, className)}
      {...props}
    />
  );
}
