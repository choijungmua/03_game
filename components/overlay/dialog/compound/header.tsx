import { cn } from "@/lib";
import { DIALOG_STYLES } from "../variable";
import { DialogHeaderProps } from "../type";
import { SLOT } from "../constants";

export function Header({ className, ...props }: DialogHeaderProps) {
  return (
    <div
      data-slot={SLOT.HEADER}
      className={cn(DIALOG_STYLES.header, className)}
      {...props}
    />
  );
}
