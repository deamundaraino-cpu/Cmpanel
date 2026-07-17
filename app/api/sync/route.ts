import { NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { runSync } from "@/lib/syncEngine";

export const maxDuration = 300;

export async function POST() {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await runSync(auth.clientId, 100);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return fail(e);
  }
}
