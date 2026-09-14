import type { MetadataRoute } from "next";

import { GAMES } from "@/lib/games/registry";

const SITE_URL = "https://ggpli.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["", "/list", "/privacy", "/terms", "/contact"].map((path) => ({
    url: `${SITE_URL}${path}`,
  }));

  const gamePages = GAMES.map((game) => ({
    url: `${SITE_URL}/games/${game.slug}`,
  }));

  return [...staticPages, ...gamePages];
}
