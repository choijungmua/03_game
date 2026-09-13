import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib";
import { TOOLTIP_STYLES } from "../variable";
import { TooltipContentProps } from "../type";
import { SLOT, DEFAULT } from "../constants";

export function Content({
  className,
  sideOffset = DEFAULT.SIDE_OFFSET,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot={SLOT.CONTENT}
        sideOffset={sideOffset}
        className={cn(TOOLTIP_STYLES.content, className)}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className={TOOLTIP_STYLES.arrow} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
