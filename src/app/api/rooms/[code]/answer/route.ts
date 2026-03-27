import { getRoom, sanitizeRoom, submitAnswerByPlayerId } from "@/lib/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const body = await request.json();
  const playerId = typeof body?.playerId === "string" ? body.playerId : "";
  const answer = typeof body?.answer === "string" ? body.answer : "";

  const room = await getRoom(code.trim().toUpperCase());
  if (!room) {
    return Response.json({ error: "Room tidak ditemukan." }, { status: 404 });
  }

  const result = await submitAnswerByPlayerId(room.code, playerId, answer);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  if (!result.room) {
    return Response.json({ error: "Gagal memperbarui jawaban." }, { status: 500 });
  }

  return Response.json(sanitizeRoom(result.room));
}
