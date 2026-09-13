import { cn } from "@/lib";
import { PAGINATION_STYLES } from "../variable";
import { PaginationProps } from "../type";
import { SLOT, DEFAULT } from "../constants";

export function Root({
  role = DEFAULT.ROLE,
  size = DEFAULT.SIZE,
  className,
  ...props
}: PaginationProps) {
  return (
    <nav
      role={role}
      aria-label={props["aria-label"] ?? DEFAULT.ARIA_LABEL}
      data-slot={SLOT.ROOT}
      data-size={size}
      className={cn(PAGINATION_STYLES.nav, className)}
      {...props}
    />
  );
}
