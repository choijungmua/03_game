import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenuGroupProps } from "../type";
import { SLOT } from "../constants";

export function Group({ ...props }: DropdownMenuGroupProps) {
  return <DropdownMenuPrimitive.Group data-slot={SLOT.GROUP} {...props} />;
}
