import { ChevronRight } from "lucide-react";
import { cn } from "@/lib";
import { Link } from "./link";
import { PaginationNavigationProps, PaginationSize } from "../type";
import { PAGINATION_STYLES } from "../variable";
import { SLOT, DEFAULT } from "../constants";

export function Next({
  className,
  size = DEFAULT.SIZE,
  label = DEFAULT.NEXT_TEXT,
  hideText = false,
  ...props
}: PaginationNavigationProps) {
  return (
    <Link
      aria-label={props["aria-label"] ?? DEFAULT.NEXT_LABEL}
      data-slot={SLOT.NEXT}
      size={size}
      className={cn(
        PAGINATION_STYLES.navigation.base,
        PAGINATION_STYLES.navigation.size[size as PaginationSize],
        className,
      )}
      {...props}
    >
      {!hideText && <span className="hidden sm:block">{label}</span>}
      <ChevronRight className={PAGINATION_STYLES.icon.size[size as PaginationSize]} />
    </Link>
  );
}
