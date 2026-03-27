import { getSyncedRoom } from "@/lib/game-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const room = await getSyncedRoom(code.trim().toUpperCase());

  if (!room) {
    return Response.json({ error: "Room tidak ditemukan." }, { status: 404 });
  }

  return Response.json(room);
}
