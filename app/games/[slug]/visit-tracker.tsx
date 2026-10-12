"use client";

import { useEffect } from "react";

import { recordGameTelemetry, recordGameVisit, wasGameCompleted } from "@/lib/games/game-events";

export function GameVisitTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const openedAt = performance.now();
    const storageKey = `game-last-played:${slug}`;
    const resumed = localStorage.getItem(storageKey) !== null;
    localStorage.setItem(storageKey, new Date().toISOString());
    void recordGameVisit(slug);
    void recordGameTelemetry(slug, "game_start");
    if (resumed) void recordGameTelemetry(slug, "game_resume");
    const leave = () => {
      if (wasGameCompleted(slug)) return;
      void recordGameTelemetry(slug, "game_quit", {
        durationSeconds: Math.max(0, (performance.now() - openedAt) / 1000),
        result: "left",
      });
    };
    window.addEventListener("pagehide", leave, { once: true });
    return () => window.removeEventListener("pagehide", leave);
  }, [slug]);
  return null;
}
