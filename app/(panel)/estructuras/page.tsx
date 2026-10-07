import StructuresManager from "@/components/StructuresManager";
import { requireClient } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StructuresPage() {
  const { clientId } = await requireClient();
  const sql = getSql();
  const [cliente] = await sql<{ nombre: string }[]>`SELECT nombre FROM clients WHERE id = ${clientId}`;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight">Estructuras y formatos</h1>
      <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-zinc-400">
        Galería de estructuras de guion por pilar de contenido —crecimiento para llegar a gente nueva,
        adoctrinamiento para ganar su confianza, conversión para pedir una acción— y de formatos de grabación.
        Cada ficha dice qué señal de Instagram empuja, cuándo usarla y cuándo no. Aquí ves las generales y las de{" "}
        <strong className="text-zinc-300">{cliente?.nombre || "la marca activa"}</strong>.
      </p>

      <div className="mt-6">
        <StructuresManager clienteNombre={cliente?.nombre || "esta marca"} />
      </div>
    </div>
  );
}
