import { FabProps } from "./type";

export const FAB_STYLES = {
  wrapper: "fixed z-sticky",
  base: "rounded-full shadow-lg hover:shadow-xl transition-shadow active:animate-scale-press",
  position: {
    "bottom-right": "bottom-6 right-6 pb-safe-bottom pr-safe-right",
    "bottom-left": "bottom-6 left-6 pb-safe-bottom pl-safe-left",
    "bottom-center": "bottom-6 left-1/2 -translate-x-1/2 pb-safe-bottom",
  },
} as const;

export const FAB_POSITION_CLASSES: Record<NonNullable<FabProps["position"]>, string> = FAB_STYLES.position;
