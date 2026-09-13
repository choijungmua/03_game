import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenuPortalProps } from "../type";
import { SLOT } from "../constants";

export function Portal({ ...props }: DropdownMenuPortalProps) {
  return <DropdownMenuPrimitive.Portal data-slot={SLOT.PORTAL} {...props} />;
}
