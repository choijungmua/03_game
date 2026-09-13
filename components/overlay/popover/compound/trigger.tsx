import * as PopoverPrimitive from "@radix-ui/react-popover";

import { PopoverTriggerProps } from "../type";
import { SLOT } from "../constants";

export function Trigger({ ...props }: PopoverTriggerProps) {
  return <PopoverPrimitive.Trigger data-slot={SLOT.TRIGGER} {...props} />;
}
