import { NextRequest } from "next/server";
import { bearer, handleMcp } from "@/lib/mcp/http";

// Conector MCP con el token en la cabecera (Claude Code y clientes que admiten headers):
//   claude mcp add --transport http brandpanel https://…/api/mcp --header "Authorization: Bearer bp_…"
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handleMcp(req, bearer(req));
}

export async function GET(req: NextRequest) {
  return handleMcp(req, bearer(req));
}

export async function DELETE(req: NextRequest) {
  return handleMcp(req, bearer(req));
}
