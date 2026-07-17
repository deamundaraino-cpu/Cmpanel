import BrandForm from "@/components/BrandForm";
import { buildBrandBrief, hasBrandBrief } from "@/lib/brand";
import { requireClient } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const { clientId } = await requireClient();
  const complete = await hasBrandBrief(clientId);
  const brief = await buildBrandBrief(clientId);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Cerebro de marca</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        Todo lo que la IA necesita para entender al CLIENTE ACTIVO: identidad,
        cliente ideal, líneas de contenido y objetivos. Esta ficha se inyecta
        automáticamente cada vez que el sistema analiza sus métricas, investiga
        su nicho o diseña una propuesta.
      </p>

      <div className="mt-6">
        <BrandForm />
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-5">
        <p className="text-xs font-medium text-zinc-400">
          👁️ Así ve la IA a este cliente ahora mismo
        </p>
        {complete ? (
          <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-zinc-500">
            {brief}
          </pre>
        ) : (
          <p className="mt-2 text-xs text-zinc-600">
            Aún no has rellenado nada — completa al menos el cliente ideal y
            los pilares de contenido para notar la diferencia en las ideas y
            propuestas que genere.
          </p>
        )}
      </div>
    </div>
  );
}
