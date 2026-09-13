import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenuSubProps } from "../type";
import { SLOT } from "../constants";

export function Sub({ ...props }: DropdownMenuSubProps) {
  return <DropdownMenuPrimitive.Sub data-slot={SLOT.SUB} {...props} />;
}
