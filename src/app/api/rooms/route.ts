import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Player = {
  id: string;
  name: string;
  score: number;
  hasAnswered: boolean;
};

type Room = {
  code: string;
  hostId: string;
  players: Player[];
  status: "lobby";
  round: number;
  maxRounds: number;
  questionEndsAt: null;
  currentQuestion: null;
};

declare global {
  // eslint-disable-next-line no-var
  var __triviaRooms: Map<string, Room> | undefined;
}

const rooms = globalThis.__triviaRooms ?? new Map<string, Room>();
globalThis.__triviaRooms = rooms;

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = body?.action;
  const rawName = typeof body?.name === "string" ? body.name : "";
  const name = rawName.replace(/\s+/g, " ").trim();

  if (!name) {
    return Response.json({ error: "Masukkan nickname dulu." }, { status: 400 });
  }

  if (action === "create") {
    let code = generateRoomCode();
    while (rooms.has(code)) code = generateRoomCode();

    const hostId = randomUUID();
    const room: Room = {
      code,
      hostId,
      players: [{ id: hostId, name, score: 0, hasAnswered: false }],
      status: "lobby",
      round: 0,
      maxRounds: 5,
      questionEndsAt: null,
      currentQuestion: null,
    };

    rooms.set(code, room);
    return Response.json(room);
  }

  if (action === "join") {
    const rawCode = typeof body?.code === "string" ? body.code : "";
    const code = rawCode.replace(/\s+/g, "").trim().toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      return Response.json({ error: "Room tidak ditemukan." }, { status: 404 });
    }

    const duplicateName = room.players.some((player) => player.name.toLowerCase() === name.toLowerCase());
    if (duplicateName) {
      return Response.json({ error: "Nickname sudah dipakai di room ini." }, { status: 400 });
    }

    room.players.push({ id: randomUUID(), name, score: 0, hasAnswered: false });
    return Response.json(room);
  }

  return Response.json({ error: "Action tidak valid." }, { status: 400 });
}
