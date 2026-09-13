import { cn } from "@/lib";
import { POPOVER_STYLES } from "../variable";
import { PopoverTitleProps } from "../type";
import { SLOT } from "../constants";

export function Title({ className, ...props }: PopoverTitleProps) {
  return (
    <div
      data-slot={SLOT.TITLE}
      className={cn(POPOVER_STYLES.title, className)}
      {...props}
    />
  );
}
