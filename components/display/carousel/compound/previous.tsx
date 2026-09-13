"use client";

import { ComponentProps } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib";
import { Button } from "@/components/inputs/button";
import { CAROUSEL_STYLES } from "../variable";
import { useCarouselContext } from "./context";
import { BASIC_STYLES, ORIENTATION, SLOT } from "../constants";
import { ButtonProps } from "@/components/inputs/button/type";

export function Previous({
  variant = BASIC_STYLES.BUTTON_VARIANT as ButtonProps["variant"],
  size = BASIC_STYLES.BUTTON_SIZE as ButtonProps["size"],
  className,
  ...props
}: ComponentProps<typeof Button>) {
  const { orientation, scrollPrev, canScrollPrev } = useCarouselContext();

  return (
    <Button
      data-slot={SLOT.PREVIOUS}
      variant={variant}
      size={size}
      className={cn(
        CAROUSEL_STYLES.previous,
        orientation === ORIENTATION.HORIZONTAL
          ? BASIC_STYLES.HORIZONTAL_BUTTON_PREVIOUS
          : BASIC_STYLES.VERTICAL_BUTTON_PREVIOUS,
        className,
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ChevronLeft />
      <span className="sr-only">Previous slide</span>
    </Button>
  );
}