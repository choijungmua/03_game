import * as LabelPrimitive from "@radix-ui/react-label";
import { ComponentPropsWithoutRef } from "react";
import { VariantProps } from "class-variance-authority";
import { labelVariants } from "./variable";

export interface LabelProps
  extends ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {
  required?: boolean;
}