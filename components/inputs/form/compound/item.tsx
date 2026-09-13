"use client";

import { type ComponentProps, useId } from "react";
import { cn } from "@/lib";
import { FORM_SLOTS } from "../constants";
import { FORM_STYLES } from "../variable";
import { FormItemContext } from "./context";

export function Item({ className, ...props }: ComponentProps<"div">) {
  const id = useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        data-slot={FORM_SLOTS.ITEM}
        className={cn(FORM_STYLES.item, className)}
        {...props}
      />
    </FormItemContext.Provider>
  );
}
