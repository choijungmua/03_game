import { cn } from "@/lib";
import { POPOVER_STYLES } from "../variable";
import { PopoverDescriptionProps } from "../type";
import { SLOT } from "../constants";

export function Description({ className, ...props }: PopoverDescriptionProps) {
  return (
    <p
      data-slot={SLOT.DESCRIPTION}
      className={cn(POPOVER_STYLES.description, className)}
      {...props}
    />
  );
}
