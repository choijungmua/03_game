import { cn } from "@/lib";
import { CARD_STYLES } from "../variable";
import { CardTitleProps } from "../type";
import { SLOT } from "../constants";

export function Title({ className, ...props }: CardTitleProps) {
  return (
    <div
      data-slot={SLOT.TITLE}
      className={cn(CARD_STYLES.title, className)}
      {...props}
    />
  );
}
