import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/syncEngine";

export const maxDuration = 300;

/**
 * Cron diario de Vercel (ver vercel.json). Sync incremental capado a 25 posts
 * para respetar el límite de duración del plan Hobby; el sync completo sigue
 * disponible con el botón manual del Dashboard.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const result = await runSync(25);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
