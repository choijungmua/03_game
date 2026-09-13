import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib";
import { DROPDOWN_MENU_STYLES } from "../variable";
import { DropdownMenuItemProps } from "../type";
import { SLOT, DEFAULT } from "../constants";

export function Item({
  className,
  inset,
  variant = DEFAULT.VARIANT,
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot={SLOT.ITEM}
      data-inset={inset}
      data-variant={variant}
      className={cn(DROPDOWN_MENU_STYLES.item, className)}
      {...props}
    />
  );
}
