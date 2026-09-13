import { cn } from "@/lib";
import { CARD_STYLES } from "../variable";
import { CardDescriptionProps } from "../type";
import { SLOT } from "../constants";

export function Description({ className, ...props }: CardDescriptionProps) {
  return (
    <div
      data-slot={SLOT.DESCRIPTION}
      className={cn(CARD_STYLES.description, className)}
      {...props}
    />
  );
}
