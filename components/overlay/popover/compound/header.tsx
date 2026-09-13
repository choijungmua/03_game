import { cn } from "@/lib";
import { POPOVER_STYLES } from "../variable";
import { PopoverHeaderProps } from "../type";
import { SLOT } from "../constants";

export function Header({ className, ...props }: PopoverHeaderProps) {
  return (
    <div
      data-slot={SLOT.HEADER}
      className={cn(POPOVER_STYLES.header, className)}
      {...props}
    />
  );
}
