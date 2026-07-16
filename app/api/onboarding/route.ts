import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { getSql } from "@/lib/db";

/** Marca el onboarding como completado (al terminar o saltar el wizard). */
export async function POST() {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  await getSql()`UPDATE users SET onboarded = 1 WHERE id = ${auth.userId}`;
  return NextResponse.json({ ok: true });
}
