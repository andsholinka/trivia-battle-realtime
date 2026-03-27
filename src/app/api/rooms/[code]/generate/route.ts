import { generateQuestionsForRoom, getRoom, sanitizeRoom } from "@/lib/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const body = await request.json();
  const hostId = typeof body?.hostId === "string" ? body.hostId : "";
  const category = typeof body?.category === "string" ? body.category : "";

  const room = await getRoom(code.trim().toUpperCase());
  if (!room) {
    return Response.json({ error: "Room tidak ditemukan." }, { status: 404 });
  }

  const result = await generateQuestionsForRoom(room.code, hostId, category);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  if (!result.room) {
    return Response.json({ error: "Gagal generate pertanyaan." }, { status: 500 });
  }

  return Response.json(sanitizeRoom(result.room));
}
