import { PaginationItemProps } from "../type";
import { SLOT } from "../constants";

export function Item({ ...props }: PaginationItemProps) {
  return <li data-slot={SLOT.ITEM} {...props} />;
}
