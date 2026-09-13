"use client";

import { type ComponentProps } from "react";
import { cn } from "@/lib";
import { FORM_SLOTS } from "../constants";
import { FORM_STYLES } from "../variable";
import { useFormField } from "./context";

export function Tip({ className, ...props }: ComponentProps<"p">) {
  const { formDescriptionId } = useFormField();

  return (
    <p
      data-slot={FORM_SLOTS.TIP}
      id={formDescriptionId}
      className={cn(FORM_STYLES.tip, className)}
      {...props}
    />
  );
}
