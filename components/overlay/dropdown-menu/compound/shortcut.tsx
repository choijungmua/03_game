import { cn } from "@/lib";
import { DROPDOWN_MENU_STYLES } from "../variable";
import { DropdownMenuShortcutProps } from "../type";
import { SLOT } from "../constants";

export function Shortcut({
  className,
  ...props
}: DropdownMenuShortcutProps) {
  return (
    <span
      data-slot={SLOT.SHORTCUT}
      className={cn(DROPDOWN_MENU_STYLES.shortcut, className)}
      {...props}
    />
  );
}
