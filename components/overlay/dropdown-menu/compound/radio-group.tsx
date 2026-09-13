import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenuRadioGroupProps } from "../type";
import { SLOT } from "../constants";

export function RadioGroup({ ...props }: DropdownMenuRadioGroupProps) {
  return (
    <DropdownMenuPrimitive.RadioGroup data-slot={SLOT.RADIO_GROUP} {...props} />
  );
}
