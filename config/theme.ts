import type { ThemeProviderProps } from "next-themes";

export const THEME = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
} as const;

export const themeConfig: Omit<ThemeProviderProps, "children"> = {
  attribute: "class",
  defaultTheme: THEME.DARK,
  enableSystem: false,
  disableTransitionOnChange: true,
};
