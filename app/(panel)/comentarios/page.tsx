import CommentsInbox from "@/components/CommentsInbox";

export const dynamic = "force-dynamic";

export default async function CommentsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Comentarios</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        Los comentarios no son solo materia prima para ideas: son las personas
        que ya te están prestando atención. Marca a quien pregunta con intención
        de compra y detecta quién vuelve una y otra vez — ahí está tu comunidad
        real.
      </p>

      <div className="mt-6">
        <CommentsInbox />
      </div>
    </div>
  );
}
