import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { TooltipProviderProps } from "../type";
import { SLOT, DEFAULT } from "../constants";

export function Provider({
  delayDuration = DEFAULT.DELAY_DURATION,
  ...props
}: TooltipProviderProps) {
  return (
    <TooltipPrimitive.Provider
      data-slot={SLOT.PROVIDER}
      delayDuration={delayDuration}
      {...props}
    />
  );
}
