import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenuTriggerProps } from "../type";
import { SLOT } from "../constants";

export function Trigger({ ...props }: DropdownMenuTriggerProps) {
  return (
    <DropdownMenuPrimitive.Trigger data-slot={SLOT.TRIGGER} {...props} />
  );
}
