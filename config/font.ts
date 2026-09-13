import localFont from "next/font/local";

export const pretendard = localFont({
  src: [
    { path: "../app/fonts/Pretendard-Regular.woff2", weight: "400" },
    { path: "../app/fonts/Pretendard-Medium.woff2", weight: "500" },
    { path: "../app/fonts/Pretendard-SemiBold.woff2", weight: "600" },
    { path: "../app/fonts/Pretendard-Bold.woff2", weight: "700" },
  ],
  variable: "--font-pretendard",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});
