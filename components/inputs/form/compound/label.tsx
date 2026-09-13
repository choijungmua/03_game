"use client";

import { type ComponentProps } from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { Label as BaseLabel } from "@/components";
import { cn } from "@/lib";
import { FORM_SLOTS } from "../constants";
import { FORM_STYLES } from "../variable";
import { useFormField } from "./context";

export function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  const { error, formItemId } = useFormField();

  return (
    <BaseLabel
      data-slot={FORM_SLOTS.LABEL}
      data-error={!!error}
      className={cn(FORM_STYLES.label, FORM_STYLES.label_error, className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}
