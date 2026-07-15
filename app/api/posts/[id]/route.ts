import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await guard();
  if (g) return g;
  try {
    const { id } = await params;
    const { campaign_id } = await req.json();
    await getSql()`
      UPDATE posts SET campaign_id = ${campaign_id || null} WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
