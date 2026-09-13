import * as PopoverPrimitive from "@radix-ui/react-popover";

import { PopoverAnchorProps } from "../type";
import { SLOT } from "../constants";

export function Anchor({ ...props }: PopoverAnchorProps) {
  return <PopoverPrimitive.Anchor data-slot={SLOT.ANCHOR} {...props} />;
}
