import { type VariantProps } from "class-variance-authority";
import { badgeVariants } from "./variable";

export interface BadgeProps
  extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}
