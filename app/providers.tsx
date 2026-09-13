"use client";

import { ThemeProvider } from "next-themes";

import { themeConfig } from "@/config";

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ThemeProvider {...themeConfig}>{children}</ThemeProvider>;
}
