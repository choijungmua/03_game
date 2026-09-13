import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib";
import { DIALOG_STYLES } from "../variable";
import { DialogContentProps } from "../type";
import { SLOT, DEFAULT } from "../constants";
import { Portal } from "./portal";
import { Overlay } from "./overlay";

export function Content({
  className,
  children,
  showCloseButton = DEFAULT.SHOW_CLOSE_BUTTON,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  ...props
}: DialogContentProps) {
  return (
    <Portal>
      <Overlay />
      <DialogPrimitive.Content
        data-slot={SLOT.CONTENT}
        className={cn(DIALOG_STYLES.content, className)}
        {...props}
        onInteractOutside={(e) => { if (!closeOnOverlayClick) e.preventDefault(); }}
        onPointerDownOutside={(e) => { if (!closeOnOverlayClick) e.preventDefault(); }}
        onFocusOutside={(e) => { if (!closeOnOverlayClick) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!closeOnEscape) e.preventDefault(); }}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot={SLOT.CLOSE}
            className={DIALOG_STYLES.close}
          >
            <X />
            <span className="sr-only">{DEFAULT.CLOSE_BUTTON_SR_TEXT}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </Portal>
  );
}
