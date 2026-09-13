import { VariantProps } from "class-variance-authority";
import { loadingVariants } from "./variable";

export interface LoadingProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof loadingVariants> {
  size?: number | string;
  fullScreen?: boolean;
  description?: string;
}
