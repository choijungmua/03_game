"use client";

import { ComponentProps } from "react";
import { cn } from "@/lib";
import { CAROUSEL_STYLES } from "../variable";
import { useCarouselContext } from "./context";
import { ORIENTATION, SLOT } from "../constants";

export function Item({ className, ...props }: ComponentProps<"div">) {
  const { orientation } = useCarouselContext();

  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot={SLOT.ITEM}
      className={cn(
        CAROUSEL_STYLES.item,
        orientation === ORIENTATION.HORIZONTAL ? "pl-4" : "pt-4",
        className,
      )}
      {...props}
    />
  );
}
