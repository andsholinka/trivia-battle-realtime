import { NextRequest, NextResponse } from "next/server";
import { returnRoomToLobby, getRoom } from "@/lib/rooms";

// POST /api/rooms/[code]/return-to-lobby - Return room to lobby for new game (keep all players)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const upperCode = code.toUpperCase();
    
    // Get hostId from request body
    const body = await request.json().catch(() => ({}));
    const { hostId } = body;
    
    if (!hostId) {
      return NextResponse.json(
        { error: "Host ID diperlukan" },
        { status: 400 }
      );
    }
    
    // Check if room exists
    const room = await getRoom(upperCode);
    if (!room) {
      return NextResponse.json(
        { error: "Room tidak ditemukan" },
        { status: 404 }
      );
    }

    // Verify host
    if (room.hostId !== hostId) {
      return NextResponse.json(
        { error: "Hanya host yang bisa kembali ke lobby" },
        { status: 403 }
      );
    }
    
    // Return room to lobby state - this keeps all players but resets their scores
    const result = await returnRoomToLobby(upperCode, hostId);
    
    if (result.error || !result.room) {
      return NextResponse.json(
        { error: result.error || "Gagal mengembalikan room ke lobby" },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({ room: result.room });
  } catch (error) {
    console.error("Return to lobby error:", error);
    return NextResponse.json(
      { error: "Gagal mengembalikan room ke lobby" },
      { status: 500 }
    );
  }
}
