import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getLeadWeeks, setLeadCount, weekStart } from "@/lib/leads";

export async function GET() {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const weeks = await getLeadWeeks(auth.clientId);
  return NextResponse.json({ semanaActual: weekStart(), weeks });
}

export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json().catch(() => ({}));
    const count = Number(body.count);
    if (!Number.isFinite(count) || count < 0 || count > 1_000_000) {
      return fail(new Error("Número de leads inválido"), 400);
    }
    // La semana se calcula en el servidor: el navegador no decide el periodo.
    const week = /^\d{4}-\d{2}-\d{2}$/.test(body.week || "") ? body.week : weekStart();
    await setLeadCount(auth.clientId, week, Math.round(count));
    return NextResponse.json({ ok: true, week });
  } catch (e) {
    return fail(e);
  }
}
