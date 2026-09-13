import { cn } from "@/lib";
import { CARD_STYLES } from "../variable";
import { CardHeaderProps } from "../type";
import { SLOT } from "../constants";

export function Header({ className, ...props }: CardHeaderProps) {
  return (
    <div
      data-slot={SLOT.HEADER}
      className={cn(CARD_STYLES.header, className)}
      {...props}
    />
  );
}
