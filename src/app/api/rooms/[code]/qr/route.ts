import QRCode from "qrcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const url = new URL(request.url);
  const joinUrl = `${url.origin}/?room=${code.trim().toUpperCase()}`;
  const dataUrl = await QRCode.toDataURL(joinUrl, {
    width: 320,
    margin: 2,
    color: {
      dark: "#ffffff",
      light: "#00000000",
    },
  });

  return Response.json({ dataUrl, joinUrl });
}
