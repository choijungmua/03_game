import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib";
import { DROPDOWN_MENU_STYLES } from "../variable";
import { DropdownMenuSeparatorProps } from "../type";
import { SLOT } from "../constants";

export function Separator({
  className,
  ...props
}: DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot={SLOT.SEPARATOR}
      className={cn(DROPDOWN_MENU_STYLES.separator, className)}
      {...props}
    />
  );
}
