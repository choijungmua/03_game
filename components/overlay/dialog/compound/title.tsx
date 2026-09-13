
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib";
import { DIALOG_STYLES } from "../variable";
import { DialogTitleProps } from "../type";
import { SLOT } from "../constants";

export function Title({ className, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot={SLOT.TITLE}
      className={cn(DIALOG_STYLES.title, className)}
      {...props}
    />
  );
}
