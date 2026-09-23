import StructuresManager from "@/components/StructuresManager";
import { requireClient } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StructuresPage() {
  const { clientId } = await requireClient();
  const sql = getSql();
  const [cliente] = await sql<{ nombre: string }[]>`SELECT nombre FROM clients WHERE id = ${clientId}`;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Estructuras de guion</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        Tus plantillas de guion: convierten cualquier idea en un video de alta
        retención. Cada una puede valer para todas tus marcas o solo para una,
        porque no todas guionizan igual. Aquí ves las generales y las de{" "}
        <strong className="text-zinc-300">{cliente?.nombre || "la marca activa"}</strong>.
      </p>

      <div className="mt-6">
        <StructuresManager clienteNombre={cliente?.nombre || "esta marca"} />
      </div>
    </div>
  );
}
