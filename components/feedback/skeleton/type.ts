import { VariantProps } from "class-variance-authority";
import { skeletonVariants } from "./variable";

export interface SkeletonProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof skeletonVariants> {}