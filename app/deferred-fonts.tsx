"use client";

import { useEffect } from "react";

export function DeferredFonts() {
  useEffect(() => {
    // no-excuse-ok: calibrated system fonts keep text readable if the optional font chunk fails.
    void import("./font-styles").catch(() => undefined);
  }, []);
  return null;
}
