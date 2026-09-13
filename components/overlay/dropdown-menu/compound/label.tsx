import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib";
import { DROPDOWN_MENU_STYLES } from "../variable";
import { DropdownMenuLabelProps } from "../type";
import { SLOT } from "../constants";

export function Label({
  className,
  inset,
  ...props
}: DropdownMenuLabelProps) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot={SLOT.LABEL}
      data-inset={inset}
      className={cn(DROPDOWN_MENU_STYLES.label, className)}
      {...props}
    />
  );
}
