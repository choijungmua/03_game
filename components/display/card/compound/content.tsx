import { cn } from "@/lib";
import { CARD_STYLES } from "../variable";
import { CardContentProps } from "../type";
import { SLOT } from "../constants";

export function Content({ className, ...props }: CardContentProps) {
  return (
    <div
      data-slot={SLOT.CONTENT}
      className={cn(CARD_STYLES.content, className)}
      {...props}
    />
  );
}
