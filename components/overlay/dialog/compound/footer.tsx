
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib";
import { Button } from "@/components";
import { DIALOG_STYLES } from "../variable";
import { DialogFooterProps } from "../type";
import { SLOT, DEFAULT } from "../constants";

export function Footer({
  className,
  showCloseButton = DEFAULT.FOOTER_SHOW_CLOSE_BUTTON,
  children,
  ...props
}: DialogFooterProps) {
  return (
    <div
      data-slot={SLOT.FOOTER}
      className={cn(DIALOG_STYLES.footer, className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{DEFAULT.CLOSE_BUTTON_SR_TEXT}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}
