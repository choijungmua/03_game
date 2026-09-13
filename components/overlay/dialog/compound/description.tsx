
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib";
import { DIALOG_STYLES } from "../variable";
import { DialogDescriptionProps } from "../type";
import { SLOT } from "../constants";

export function Description({ className, ...props }: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      data-slot={SLOT.DESCRIPTION}
      className={cn(DIALOG_STYLES.description, className)}
      {...props}
    />
  );
}
