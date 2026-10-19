import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { createMcpToken, listMcpTokens, revokeMcpToken } from "@/lib/mcp/tokens";

/** Tokens del conector MCP del usuario (Ajustes → Conectar con Claude). */
export async function GET() {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await listMcpTokens(auth.userId));
  } catch (e) {
    return fail(e);
  }
}

/** body: { nombre? } — el token en claro solo se devuelve aquí, una vez. */
export async function POST(req: NextRequest) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json().catch(() => ({}));
    const existing = await listMcpTokens(auth.userId);
    if (existing.length >= 10) return fail(new Error("Tienes 10 tokens: revoca alguno antes de crear otro."), 409);
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    const { id, token } = await createMcpToken(auth.userId, nombre || null);
    const base = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, "");
    return NextResponse.json({
      ok: true,
      id,
      token,
      url_claude_ai: `${base}/api/mcp/${token}`,
      url_header: `${base}/api/mcp`,
    });
  } catch (e) {
    return fail(e);
  }
}

/** ?id= — revoca un token (Claude deja de tener acceso con él al instante). */
export async function DELETE(req: NextRequest) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) return fail(new Error("Falta el id"), 400);
  const okRevoke = await revokeMcpToken(auth.userId, id);
  if (!okRevoke) return fail(new Error("Token no encontrado"), 404);
  return NextResponse.json({ ok: true });
}
