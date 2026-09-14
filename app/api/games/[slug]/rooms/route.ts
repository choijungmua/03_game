import type { NextRequest } from "next/server";

import { ROOM_STORES } from "@/lib/games/room-stores";

interface RoomsRouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: NextRequest, { params }: RoomsRouteContext) {
  const { slug } = await params;
  const store = ROOM_STORES[slug];
  if (!store) return Response.json({ ok: false, error: "없는 게임이에요" }, { status: 404 });
  return Response.json({ ok: true, rooms: store.listRooms() });
}

export async function POST(_request: NextRequest, { params }: RoomsRouteContext) {
  const { slug } = await params;
  const store = ROOM_STORES[slug];
  if (!store) return Response.json({ ok: false, error: "없는 게임이에요" }, { status: 404 });
  return Response.json(store.createRoom());
}
