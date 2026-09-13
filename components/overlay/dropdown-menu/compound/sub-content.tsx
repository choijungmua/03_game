import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib";
import { DROPDOWN_MENU_STYLES } from "../variable";
import { DropdownMenuSubContentProps } from "../type";
import { SLOT } from "../constants";

export function SubContent({
  className,
  ...props
}: DropdownMenuSubContentProps) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot={SLOT.SUB_CONTENT}
      className={cn(DROPDOWN_MENU_STYLES.subContent, className)}
      {...props}
    />
  );
}
