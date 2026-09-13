import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib";
import { POPOVER_STYLES } from "../variable";
import { PopoverContentProps } from "../type";
import { SLOT, DEFAULT } from "../constants";

export function Content({
  className,
  align = DEFAULT.ALIGN,
  sideOffset = DEFAULT.SIDE_OFFSET,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot={SLOT.CONTENT}
        align={align}
        sideOffset={sideOffset}
        className={cn(POPOVER_STYLES.content, className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
