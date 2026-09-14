import type { NextRequest } from "next/server";

import { parsePresence, type PresenceRequest, updatePresence } from "@/lib/lobby/presence";

export async function POST(request: NextRequest) {
  let body: Partial<PresenceRequest> | null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const presence = parsePresence(body);
  if (!presence) return Response.json({ error: "잘못된 요청이에요" }, { status: 400 });

  const result = updatePresence(presence);
  if (!result) return Response.json({ error: "이 맵에 사람이 너무 많아요" }, { status: 503 });
  return Response.json(result);
}
