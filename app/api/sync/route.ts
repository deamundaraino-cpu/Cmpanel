import { NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { runSync } from "@/lib/syncEngine";

export const maxDuration = 300;

export async function POST() {
  const g = await guard();
  if (g) return g;
  try {
    const result = await runSync(100);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return fail(e);
  }
}
