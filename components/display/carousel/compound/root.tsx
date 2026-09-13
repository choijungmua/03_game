"use client";

import { ComponentProps } from "react";

import { cn } from "@/lib";
import { CAROUSEL_STYLES } from "../variable";
import { CarouselProps } from "../type";
import { CarouselContext } from "./context";
import { useCarousel } from "../hooks/useCarousel";
import { ORIENTATION, SLOT } from "../constants";

export function Root({
  orientation = ORIENTATION.HORIZONTAL,
  opts,
  setApi,
  plugins,
  className,
  children,
  ...props
}: ComponentProps<"div"> & CarouselProps) {
  const {
    carouselRef,
    api,
    scrollPrev,
    scrollNext,
    canScrollPrev,
    canScrollNext,
    handleKeyDown,
  } = useCarousel({ orientation, opts, setApi, plugins });

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api,
        opts,
        orientation:
          orientation || (opts?.axis === "y" ? ORIENTATION.VERTICAL : ORIENTATION.HORIZONTAL),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        onKeyDownCapture={handleKeyDown}
        className={cn(CAROUSEL_STYLES.root, className)}
        role="region"
        aria-roledescription="carousel"
        data-slot={SLOT.ROOT}
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}
