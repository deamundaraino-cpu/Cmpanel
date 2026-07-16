import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const { campaign_id } = await req.json();
    await getSql()`
      UPDATE posts SET campaign_id = ${campaign_id || null}
      WHERE user_id = ${auth.userId} AND id = ${id}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
