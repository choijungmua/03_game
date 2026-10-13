"use client";

import { useEffect } from "react";

import { quitGameRound, recordGameVisit, restoreGameRound, suspendGameRound } from "@/lib/games/game-events";

export function GameVisitTracker({ slug }: { slug: string }) {
  useEffect(() => {
    void recordGameVisit(slug);
    const leave = () => { void quitGameRound(slug); };
    const hide = (event: PageTransitionEvent) => {
      if (event.persisted) void suspendGameRound(slug);
      else leave();
    };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) void restoreGameRound(slug);
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      leave();
    };
  }, [slug]);
  return null;
}
