"use client";

import { type ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { useFormField } from "./context";
import { FORM_SLOTS } from "../constants";

export function Control({ ...props }: ComponentProps<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <Slot
      data-slot={FORM_SLOTS.CONTROL}
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
}
