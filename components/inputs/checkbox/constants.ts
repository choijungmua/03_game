export const SLOT = {
  ROOT: "checkbox",
  INDICATOR: "checkbox-indicator",
} as const;

export const CHECKBOX_CONFIG = {
  icon: {
    path: "M4.5 12.1l4.25 4.25 10.75-11", // 좀 더 정확한 체크 모양 경로
    viewBox: "0 0 24 24",
    strokeWidth: 2.5, // 요청하신 2.5로 변경
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  },
  animation: {
    draw: "animate-check-draw",
    zoom: "animate-check-zoom",
  },
} as const;