"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { cn } from "@/lib";
import { THEME } from "@/config/theme";
import { ICONS, TOAST_OPTIONS, SLOT } from "./constants";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = THEME.SYSTEM } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className={cn(SLOT.TOASTER, "group")}
      icons={ICONS}
      toastOptions={TOAST_OPTIONS}
      {...props}
    />
  );
};

export { Toaster };