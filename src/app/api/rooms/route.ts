import { createRoom, joinRoom } from "@/lib/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const action = body?.action;
  const rawName = typeof body?.name === "string" ? body.name : "";
  const name = rawName.replace(/\s+/g, " ").trim();

  if (!name) {
    return Response.json({ error: "Masukkan nickname dulu." }, { status: 400 });
  }

  if (action === "create") {
    const room = await createRoom(name);
    return Response.json(room);
  }

  if (action === "join") {
    const rawCode = typeof body?.code === "string" ? body.code : "";
    const code = rawCode.replace(/\s+/g, "").trim().toUpperCase();
    const result = await joinRoom(code, name);

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json(result.room);
  }

  return Response.json({ error: "Action tidak valid." }, { status: 400 });
}
