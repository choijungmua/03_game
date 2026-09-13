"use client";

import { createContext, useContext } from "react";
import { CarouselContextProps } from "../type";

export const CarouselContext = createContext<CarouselContextProps | null>(null);

export function useCarouselContext() {
  const context = useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarouselContext must be used within a <Carousel />");
  }

  return context;
}
