
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { DialogTriggerProps } from "../type";
import { SLOT } from "../constants";

export function Trigger({ ...props }: DialogTriggerProps) {
  return <DialogPrimitive.Trigger data-slot={SLOT.TRIGGER} {...props} />;
}
