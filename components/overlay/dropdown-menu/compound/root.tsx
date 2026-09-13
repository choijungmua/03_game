import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenuProps } from "../type";
import { SLOT } from "../constants";

export function Root({ ...props }: DropdownMenuProps) {
  return <DropdownMenuPrimitive.Root data-slot={SLOT.ROOT} {...props} />;
}
