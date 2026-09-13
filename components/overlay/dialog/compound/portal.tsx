
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { DialogPortalProps } from "../type";
import { SLOT } from "../constants";

export function Portal({ ...props }: DialogPortalProps) {
  return <DialogPrimitive.Portal data-slot={SLOT.PORTAL} {...props} />;
}
