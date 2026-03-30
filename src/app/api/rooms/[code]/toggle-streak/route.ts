import { toggleStreakBonus } from "@/lib/rooms";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { hostId } = body;

    if (!code || !hostId) {
      return NextResponse.json(
        { error: "Room code and hostId are required" },
        { status: 400 }
      );
    }

    const result = await toggleStreakBonus(code.toUpperCase(), hostId);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      room: result.room,
      streakBonusEnabled: result.streakBonusEnabled,
    });
  } catch (error) {
    console.error("Error toggling streak bonus:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to toggle streak bonus";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
