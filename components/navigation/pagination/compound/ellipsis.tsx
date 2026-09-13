import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib";
import { PAGINATION_STYLES } from "../variable";
import { PaginationEllipsisProps, PaginationSize } from "../type";
import { SLOT, DEFAULT } from "../constants";

export function Ellipsis({
  className,
  label = DEFAULT.ELLIPSIS_LABEL,
  size = DEFAULT.SIZE,
  ...props
}: PaginationEllipsisProps) {
  return (
    <span
      aria-hidden
      data-slot={SLOT.ELLIPSIS}
      data-size={size}
      className={cn(
        PAGINATION_STYLES.ellipsis.base,
        PAGINATION_STYLES.ellipsis.size[size as PaginationSize],
        className,
      )}
      {...props}
    >
      <MoreHorizontal className={PAGINATION_STYLES.icon.size[size as PaginationSize]} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
