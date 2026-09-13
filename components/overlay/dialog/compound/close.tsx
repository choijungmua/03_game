
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { DialogCloseProps } from "../type";
import { SLOT } from "../constants";

export function Close({ ...props }: DialogCloseProps) {
  return <DialogPrimitive.Close data-slot={SLOT.CLOSE} {...props} />;
}
