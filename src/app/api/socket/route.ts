export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response("Socket server disabled", { status: 200 });
}
