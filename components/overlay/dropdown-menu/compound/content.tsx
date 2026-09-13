import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib";
import { DROPDOWN_MENU_STYLES } from "../variable";
import { DropdownMenuContentProps } from "../type";
import { SLOT, DEFAULT } from "../constants";

export function Content({
  className,
  sideOffset = DEFAULT.SIDE_OFFSET,
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot={SLOT.CONTENT}
        sideOffset={sideOffset}
        className={cn(DROPDOWN_MENU_STYLES.content, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}
