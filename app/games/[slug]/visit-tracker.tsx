"use client";

import { useEffect } from "react";

import { recordGameVisit } from "@/lib/games/supabase";

export function GameVisitTracker({ slug }: { slug: string }) {
  useEffect(() => {
    void recordGameVisit(slug);
  }, [slug]);
  return null;
}
