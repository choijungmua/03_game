import { cva } from "class-variance-authority";

export const skeletonVariants = cva(
  "rounded-md overflow-hidden",
  {
    variants: {
      variant: {
        shimmer: [
          "bg-bg-alternative",
          // rgba 대신 globals.css의 색상 변수(gray-100/bg-neutral)를 사용
          "bg-[image:linear-gradient(135deg,transparent_40%,var(--color-bg-neutral)_50%,transparent_60%)]",
          "bg-[length:250%_250%]",
          "animate-shimmer-diagonal",
          "bg-no-repeat"
        ].join(" "),
      },
    },
  }
);
