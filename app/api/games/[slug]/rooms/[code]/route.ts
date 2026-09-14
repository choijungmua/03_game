import type { NextRequest } from "next/server";

import { ROOM_STORES } from "@/lib/games/room-stores";
import type { RoomAction, RoomResult, RoomState } from "@/lib/games/rooms";

interface RoomRouteContext {
  params: Promise<{ slug: string; code: string }>;
}

function toResponse(result: RoomResult<RoomState>) {
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

const notFound = () => Response.json({ ok: false, error: "없는 게임이에요" }, { status: 404 });
const badRequest = () => Response.json({ ok: false, error: "잘못된 요청이에요" }, { status: 400 });

export async function GET(request: NextRequest, { params }: RoomRouteContext) {
  const { slug, code } = await params;
  const store = ROOM_STORES[slug];
  if (!store) return notFound();
  return toResponse(store.readRoom(code, request.nextUrl.searchParams.get("token")));
}

export async function POST(request: NextRequest, { params }: RoomRouteContext) {
  const { slug, code } = await params;
  const store = ROOM_STORES[slug];
  if (!store) return notFound();

  let body: Partial<RoomAction>;
  try {
    body = await request.json();
  } catch {
    return badRequest();
  }
  if (typeof body?.type !== "string") return badRequest();

  return toResponse(
    store.actOnRoom(code, {
      type: body.type,
      token: typeof body.token === "string" ? body.token : undefined,
      index: typeof body.index === "number" ? body.index : undefined,
      aim:
        typeof body.aim?.x === "number" && typeof body.aim?.y === "number"
          ? { x: body.aim.x, y: body.aim.y }
          : undefined,
    }),
  );
}
