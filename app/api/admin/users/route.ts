import { NextRequest, NextResponse } from "next/server";
import { guardAdmin, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

/** PATCH { userId, ai_daily_limit } — ajusta el cupo diario de IA de un usuario. */
export async function PATCH(req: NextRequest) {
  const auth = await guardAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const { userId, ai_daily_limit } = await req.json();
    if (typeof userId !== "string" || !userId) {
      return fail(new Error("Falta userId"), 400);
    }
    const limit =
      ai_daily_limit === null || ai_daily_limit === ""
        ? null
        : Math.max(0, Math.floor(Number(ai_daily_limit)));
    if (limit !== null && !Number.isFinite(limit)) {
      return fail(new Error("Límite inválido"), 400);
    }
    await getSql()`
      UPDATE users SET ai_daily_limit = ${limit} WHERE id = ${userId}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
