import * as PopoverPrimitive from "@radix-ui/react-popover";

import { PopoverProps } from "../type";
import { SLOT } from "../constants";

export function Root({ ...props }: PopoverProps) {
  return <PopoverPrimitive.Root data-slot={SLOT.ROOT} {...props} />;
}
