import { NextRequest, NextResponse } from "next/server";
import getMongoClientPromise from "@/lib/mongodb";
import { Room } from "@/lib/rooms";

const DB_NAME = process.env.MONGODB_DB_NAME || "trivia_battle_realtime";
const COLLECTION_NAME = "rooms";
const ADMIN_CODE = process.env.ADMIN_CODE || "230825";

export async function GET(req: NextRequest) {
  try {
    const authCode = req.headers.get("x-admin-code");
    
    if (authCode !== ADMIN_CODE) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const client = await getMongoClientPromise();
    const db = client.db(DB_NAME);
    const collection = db.collection<Room>(COLLECTION_NAME);
    
    const rooms = await collection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    const formattedRooms = rooms.map((room) => ({
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      playerCount: room.players.length,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        hasAnswered: p.hasAnswered,
      })),
      round: room.round,
      maxRounds: room.maxRounds,
      category: room.category,
      questionsReady: room.questionsReady,
      currentQuestionIndex: room.currentQuestionIndex,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      questionEndsAt: room.questionEndsAt,
      leaderboardEndsAt: room.leaderboardEndsAt,
    }));
    
    const stats = {
      totalRooms: rooms.length,
      lobbyRooms: rooms.filter((r) => r.status === "lobby").length,
      activeGames: rooms.filter((r) => r.status === "question" || r.status === "leaderboard").length,
      finishedGames: rooms.filter((r) => r.status === "finished").length,
      totalPlayers: rooms.reduce((sum, r) => sum + r.players.length, 0),
    };
    
    return NextResponse.json({ success: true, rooms: formattedRooms, stats });
  } catch (error) {
    console.error("Admin rooms error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}
