import { cn } from "@/lib";
import { CARD_STYLES } from "../variable";
import { CardFooterProps } from "../type";
import { SLOT } from "../constants";

export function Footer({ className, ...props }: CardFooterProps) {
  return (
    <div
      data-slot={SLOT.FOOTER}
      className={cn(CARD_STYLES.footer, className)}
      {...props}
    />
  );
}
