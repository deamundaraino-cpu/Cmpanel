import HooksManager from "@/components/HooksManager";

export const dynamic = "force-dynamic";

export default async function HooksPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Ganchos que funcionaron</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        Cuando una pieza que aprobaste termina siendo un post ganador, su gancho
        se archiva aquí solo. Es el aprendizaje que antes se perdía: en vez de
        inventar un ángulo nuevo cada vez, parte de lo que ya demostró funcionar
        con esta audiencia.
      </p>

      <div className="mt-6">
        <HooksManager />
      </div>
    </div>
  );
}
