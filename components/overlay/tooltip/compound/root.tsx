import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { TooltipProps } from "../type";
import { SLOT, DEFAULT } from "../constants";
import { Provider } from "./provider";

export function Root({ ...props }: TooltipProps) {
  return (
    <Provider delayDuration={DEFAULT.DELAY_DURATION}>
      <TooltipPrimitive.Root data-slot={SLOT.ROOT} {...props} />
    </Provider>
  );
}
