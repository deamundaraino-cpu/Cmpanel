import StructuresManager from "@/components/StructuresManager";

export const dynamic = "force-dynamic";

export default async function StructuresPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Estructuras de guion</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        Tu librería personal de plantillas de guion, reutilizable en TODOS tus
        clientes: convierte cualquier idea en un video de alta retención.
        Elige una al crear contenido desde «Ideas y nicho» o «Publicaciones»,
        o añade las tuyas propias.
      </p>

      <div className="mt-6">
        <StructuresManager />
      </div>
    </div>
  );
}
