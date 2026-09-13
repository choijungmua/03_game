import Link from "next/link";
import { type Button } from "@/components";

export type PaginationSize = "sm" | "default" | "lg";

export type PaginationProps = {
  size?: PaginationSize;
} & React.ComponentProps<"nav">;

export type PaginationContentProps = React.ComponentProps<"ul">;

export type PaginationItemProps = React.ComponentProps<"li">;

export type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<typeof Link>;

export type PaginationNavigationProps = {
  label?: string;
  hideText?: boolean;
} & PaginationLinkProps;

export type PaginationEllipsisProps = {
  label?: string;
  size?: PaginationSize;
} & React.ComponentProps<"span">;
