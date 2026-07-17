import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getSql, ProposalRow } from "@/lib/db";
import { ensurePipelineItem } from "@/lib/pipeline";

/**
 * Decisión del cliente sobre una propuesta compartida (público, sin sesión).
 * El share_token largo y aleatorio es la credencial de esta propuesta.
 *
 * body: { decision: "aprobar" } | { decision: "cambios", comentario: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json().catch(() => ({}));
    const decision = String(body.decision || "");
    if (!["aprobar", "cambios"].includes(decision)) {
      return fail(new Error("Decisión inválida"), 400);
    }

    const sql = getSql();
    const rows = await sql<ProposalRow[]>`
      SELECT * FROM proposals WHERE share_token = ${token}
    `;
    if (!rows[0]) return fail(new Error("Enlace no válido"), 404);

    if (decision === "aprobar") {
      const updated = await sql<ProposalRow[]>`
        UPDATE proposals SET status = 'aprobada', client_feedback = NULL
        WHERE share_token = ${token}
        RETURNING *
      `;
      // La aprobación del cliente mete la pieza al Pipeline (fase «idea»).
      if (updated[0]) await ensurePipelineItem(updated[0]);
      return NextResponse.json({ ok: true, status: "aprobada" });
    }

    const comentario = String(body.comentario || "").trim().slice(0, 1000);
    if (!comentario) return fail(new Error("Escribe qué te gustaría cambiar"), 400);
    await sql`
      UPDATE proposals SET status = 'pendiente', client_feedback = ${comentario}
      WHERE share_token = ${token}
    `;
    return NextResponse.json({ ok: true, status: "cambios" });
  } catch (e) {
    return fail(e);
  }
}
