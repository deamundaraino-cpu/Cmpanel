import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const { campaign_id } = await req.json();
    await getSql()`
      UPDATE posts SET campaign_id = ${campaign_id || null}
      WHERE client_id = ${auth.clientId} AND id = ${id}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
