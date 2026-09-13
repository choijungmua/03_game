"use client";

import { ComponentProps } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib";
import { Button } from "@/components/inputs/button";
import { CAROUSEL_STYLES } from "../variable";
import { useCarouselContext } from "./context";
import { BASIC_STYLES, ORIENTATION, SLOT } from "../constants";
import { ButtonProps } from "@/components/inputs/button/type";

export function Next({
  variant = BASIC_STYLES.BUTTON_VARIANT as ButtonProps["variant"],
  size = BASIC_STYLES.BUTTON_SIZE as ButtonProps["size"],
  className,
  ...props
}: ComponentProps<typeof Button>) {
  const { orientation, scrollNext, canScrollNext } = useCarouselContext();

  return (
    <Button
      data-slot={SLOT.NEXT}
      variant={variant}
      size={size}
      className={cn(
        CAROUSEL_STYLES.next,
        orientation === ORIENTATION.HORIZONTAL
          ? BASIC_STYLES.HORIZONTAL_BUTTON_NEXT
          : BASIC_STYLES.VERTICAL_BUTTON_NEXT,
        className,
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ChevronRight />
      <span className="sr-only">Next slide</span>
    </Button>
  );
}
