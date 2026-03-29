import { NextRequest, NextResponse } from "next/server";

const ADMIN_CODE = process.env.ADMIN_CODE || "230825";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    
    if (code === ADMIN_CODE) {
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { success: false, error: "Invalid admin code" },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
