import { NextRequest } from "next/server";
import { bearer, handleMcp } from "@/lib/mcp/http";

// Conector MCP con el token en la URL, para claude.ai (los conectores
// personalizados no permiten añadir cabeceras): https://…/api/mcp/bp_…
export const maxDuration = 60;

type Ctx = { params: Promise<{ token: string }> };

async function handle(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return handleMcp(req, bearer(req) || token);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
