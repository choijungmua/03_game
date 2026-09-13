import { cn } from "@/lib";
import { CARD_STYLES } from "../variable";
import { CardActionProps } from "../type";
import { SLOT } from "../constants";

export function Action({ className, ...props }: CardActionProps) {
  return (
    <div
      data-slot={SLOT.ACTION}
      className={cn(CARD_STYLES.action, className)}
      {...props}
    />
  );
}
