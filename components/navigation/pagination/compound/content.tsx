import { cn } from "@/lib";
import { PAGINATION_STYLES } from "../variable";
import { PaginationContentProps } from "../type";
import { SLOT } from "../constants";

export function Content({ className, ...props }: PaginationContentProps) {
  return (
    <ul
      data-slot={SLOT.CONTENT}
      className={cn(PAGINATION_STYLES.content, className)}
      {...props}
    />
  );
}
