
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib";
import { DIALOG_STYLES } from "../variable";
import { DialogOverlayProps } from "../type";
import { SLOT } from "../constants";

export function Overlay({ className, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      data-slot={SLOT.OVERLAY}
      className={cn(DIALOG_STYLES.overlay, className)}
      {...props}
    />
  );
}
