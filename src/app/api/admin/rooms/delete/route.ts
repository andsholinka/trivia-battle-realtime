import { NextRequest, NextResponse } from "next/server";
import getMongoClientPromise from "@/lib/mongodb";
import { Room } from "@/lib/rooms";

const DB_NAME = process.env.MONGODB_DB_NAME || "trivia_battle_realtime";
const COLLECTION_NAME = "rooms";
const ADMIN_CODE = process.env.ADMIN_CODE || "230825";

export async function DELETE(req: NextRequest) {
  try {
    const authCode = req.headers.get("x-admin-code");
    
    if (authCode !== ADMIN_CODE) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { roomCodes } = await req.json();
    
    if (!Array.isArray(roomCodes) || roomCodes.length === 0) {
      return NextResponse.json(
        { success: false, error: "No room codes provided" },
        { status: 400 }
      );
    }
    
    const client = await getMongoClientPromise();
    const db = client.db(DB_NAME);
    const collection = db.collection<Room>(COLLECTION_NAME);
    
    const result = await collection.deleteMany({
      code: { $in: roomCodes },
    });
    
    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} room(s) deleted successfully`,
    });
  } catch (error) {
    console.error("Admin delete rooms error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete rooms" },
      { status: 500 }
    );
  }
}
