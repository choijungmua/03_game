import NextLink from "next/link";
import { cn } from "@/lib";
import { buttonVariants } from "@/components";
import { PaginationLinkProps } from "../type";
import { SLOT, DEFAULT } from "../constants";
import { PAGINATION_STYLES } from "../variable";

export function Link({
  className,
  isActive,
  size = DEFAULT.SIZE,
  ...props
}: PaginationLinkProps) {
  return (
    <NextLink
      aria-current={isActive ? "page" : undefined}
      aria-disabled={isActive}
      tabIndex={isActive ? -1 : undefined}
      data-slot={SLOT.LINK}
      data-active={isActive}
      data-size={size}
      className={cn(
        buttonVariants({
          variant: "ghost",
          size,
        }),
        isActive && PAGINATION_STYLES.link.active,
        !isActive && PAGINATION_STYLES.link.inactive,
        className,
      )}
      {...props}
    />
  );
}
