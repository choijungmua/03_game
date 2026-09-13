"use client";

import { ComponentProps } from "react";
import { cn } from "@/lib";
import { CAROUSEL_STYLES } from "../variable";
import { useCarouselContext } from "./context";
import { ORIENTATION, SLOT } from "../constants";

export function Content({ className, ...props }: ComponentProps<"div">) {
  const { carouselRef, orientation } = useCarouselContext();

  return (
    <div
      ref={carouselRef}
      className={CAROUSEL_STYLES.contentWrapper}
      data-slot={SLOT.CONTENT}
    >
      <div
        className={cn(
          CAROUSEL_STYLES.content,
          orientation === ORIENTATION.HORIZONTAL ? "-ml-4" : "-mt-4 flex-col",
          className,
        )}
        {...props}
      />
    </div>
  );
}
