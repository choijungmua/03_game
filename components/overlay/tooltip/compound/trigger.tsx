import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { TooltipTriggerProps } from "../type";
import { SLOT } from "../constants";

export function Trigger({ ...props }: TooltipTriggerProps) {
  return <TooltipPrimitive.Trigger data-slot={SLOT.TRIGGER} {...props} />;
}
