"use client";

import { type ComponentProps } from "react";
import { cn } from "@/lib";
import { FORM_SLOTS } from "../constants";
import { FORM_STYLES } from "../variable";
import { useFormField } from "./context";

export function Message({ className, ...props }: ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? "") : props.children;

  if (!body) {
    return null;
  }

  return (
    <p
      data-slot={FORM_SLOTS.MESSAGE}
      id={formMessageId}
      className={cn(FORM_STYLES.message, className)}
      {...props}
    >
      {body}
    </p>
  );
}
