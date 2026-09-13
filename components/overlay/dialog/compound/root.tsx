
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { DialogProps } from "../type";
import { SLOT } from "../constants";

export function Root({ ...props }: DialogProps) {
  return <DialogPrimitive.Root data-slot={SLOT.ROOT} {...props} />;
}
