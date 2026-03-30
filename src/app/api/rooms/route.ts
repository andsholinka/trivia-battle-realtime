import { createRoom, joinRoom, kickPlayerById } from "@/lib/rooms";
import { checkCreateRoomRateLimit, getClientIP } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const action = body?.action;
  const rawName = typeof body?.name === "string" ? body.name : "";
  const name = rawName.replace(/\s+/g, " ").trim();

  // Action kick tidak membutuhkan name
  if (action === "kick") {
    const { code, playerId, hostId } = body;

    if (!code || !playerId || !hostId) {
      return Response.json(
        { error: "Code, playerId, dan hostId wajib diisi." },
        { status: 400 }
      );
    }

    const result = await kickPlayerById(code.toUpperCase(), playerId, hostId);

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({
      success: true,
      playerName: result.playerName,
      deletedCode: result.deletedCode,
    });
  }

  if (!name) {
    return Response.json({ error: "Masukkan nickname dulu." }, { status: 400 });
  }

  if (action === "create") {
    // Rate limiting check for createRoom
    const clientIP = getClientIP(request);
    const rateLimit = await checkCreateRoomRateLimit(clientIP);

    if (!rateLimit.allowed) {
      const minutes = Math.ceil(rateLimit.resetInSeconds / 60);
      return Response.json(
        {
          error: `Rate limit exceeded. You can create up to 5 rooms per hour. Please try again in ${minutes} minute${minutes !== 1 ? "s" : ""}.`,
          rateLimit: {
            remaining: 0,
            resetInSeconds: rateLimit.resetInSeconds,
          },
        },
        { status: 429 }
      );
    }

    const room = await createRoom(name);
    return Response.json({
      ...room,
      rateLimit: {
        remaining: rateLimit.remaining,
      },
    });
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
