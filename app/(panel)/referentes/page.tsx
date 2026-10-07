import Link from "next/link";
import { getSql, ReferenteRow, ReferentePiezaRow } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { outlierRatios, readAnalisis } from "@/lib/referentes";
import PageHeader from "@/components/PageHeader";
import ReferentesManager from "@/components/ReferentesManager";

export const dynamic = "force-dynamic";

export default async function ReferentesPage() {
  const { clientId } = await requireClient();
  const sql = getSql();
  const referentes = await sql<ReferenteRow[]>`
    SELECT * FROM referentes WHERE client_id = ${clientId} ORDER BY id ASC
  `;
  const piezas = await sql<ReferentePiezaRow[]>`
    SELECT * FROM referente_piezas WHERE client_id = ${clientId} ORDER BY id DESC
  `;
  const ratios = outlierRatios(piezas);
  const analizadas = piezas.filter((p) => p.analisis).length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Referentes"
        subtitle={
          <>
            Cuentas de referencia o competencia y sus mejores piezas, pegadas a mano. La IA extrae el patrón
            (gancho, estructura, formato) — nunca el tema — y lo usa para proponer ideas en{" "}
            <Link href="/ideas" className="text-indigo-400 hover:text-indigo-300">
              Ideas
            </Link>{" "}
            con la fuente «Referentes».
          </>
        }
        actions={
          analizadas > 0 ? (
            <span className="text-xs text-zinc-500">
              {analizadas} pieza{analizadas > 1 ? "s" : ""} analizada{analizadas > 1 ? "s" : ""}
            </span>
          ) : undefined
        }
      />
      <div className="mt-6">
        <ReferentesManager
          referentes={referentes.map((r) => ({ id: r.id, handle: r.handle, nombre: r.nombre, notas: r.notas }))}
          piezas={piezas.map((p) => ({
            id: p.id,
            referente_id: p.referente_id,
            url: p.url,
            formato: p.formato,
            texto: p.texto,
            vistas: p.vistas,
            likes: p.likes,
            comentarios: p.comentarios,
            analisis: readAnalisis(p.analisis),
            ratio: ratios.get(p.id) ?? null,
          }))}
        />
      </div>
    </div>
  );
}
