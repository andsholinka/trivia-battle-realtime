import { getRoom, sanitizeRoom } from "@/lib/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const room = await getRoom(code.trim().toUpperCase());

  if (!room) {
    return Response.json({ error: "Room tidak ditemukan." }, { status: 404 });
  }

  return Response.json(sanitizeRoom(room));
}
