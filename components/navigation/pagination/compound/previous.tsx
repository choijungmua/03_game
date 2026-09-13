import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib";
import { Link } from "./link";
import { PaginationNavigationProps, PaginationSize } from "../type";
import { PAGINATION_STYLES } from "../variable";
import { SLOT, DEFAULT } from "../constants";

export function Previous({
  className,
  size = DEFAULT.SIZE,
  label = DEFAULT.PREVIOUS_TEXT,
  hideText = false,
  ...props
}: PaginationNavigationProps) {
  return (
    <Link
      aria-label={props["aria-label"] ?? DEFAULT.PREVIOUS_LABEL}
      data-slot={SLOT.PREVIOUS}
      size={size}
      className={cn(
        PAGINATION_STYLES.navigation.base,
        PAGINATION_STYLES.navigation.size[size as PaginationSize],
        className,
      )}
      {...props}
    >
      <ChevronLeft className={PAGINATION_STYLES.icon.size[size as PaginationSize]} />
      {!hideText && <span className="hidden sm:block">{label}</span>}
    </Link>
  );
}
