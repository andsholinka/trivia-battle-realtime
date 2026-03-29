import { getRoom, returnRoomToLobby, sanitizeRoom } from "@/lib/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const body = await request.json();
  const hostId = typeof body?.hostId === "string" ? body.hostId : "";

  const room = await getRoom(code.trim().toUpperCase());
  if (!room) {
    return Response.json({ error: "Room tidak ditemukan." }, { status: 404 });
  }

  const result = await returnRoomToLobby(room.code, hostId);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  if (!result.room) {
    return Response.json({ error: "Gagal kembali ke lobby." }, { status: 500 });
  }

  return Response.json(sanitizeRoom(result.room));
}
