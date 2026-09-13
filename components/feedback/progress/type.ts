import { VariantProps } from "class-variance-authority";
import { progressVariants } from "./variable";

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
  value?: number;
}