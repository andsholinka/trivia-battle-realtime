import { NextResponse } from "next/server";
import { toggleStreakBonus } from "@/lib/rooms";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { hostId } = body;

    if (!hostId) {
      return NextResponse.json({ error: "Host ID diperlukan." }, { status: 400 });
    }

    const result = await toggleStreakBonus(code, hostId);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ 
      room: result.room,
      streakBonusEnabled: result.streakBonusEnabled 
    });
  } catch (error) {
    console.error("Toggle streak bonus error:", error);
    return NextResponse.json({ error: "Gagal mengubah pengaturan streak bonus." }, { status: 500 });
  }
}
