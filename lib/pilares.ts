/**
 * Los 3 pilares de contenido, en un solo sitio.
 * Antes vivían duplicados en /api/research y en la página de Ideas; ahora que
 * el pilar viaja hasta el calendario hacen falta también ahí, así que se
 * centralizan para que etiquetas y colores no se desincronicen.
 */
export const PILARES = ["crecimiento", "adoctrinamiento", "conversion"] as const;

export type Pilar = (typeof PILARES)[number];

export function isPilar(v: unknown): v is Pilar {
  return typeof v === "string" && (PILARES as readonly string[]).includes(v);
}

/** Normaliza cualquier entrada a un pilar válido (o null si no lo es). */
export function toPilar(v: unknown): Pilar | null {
  return isPilar(v) ? v : null;
}

export const PILAR_META: Record<
  Pilar,
  { label: string; short: string; badge: string; dot: string; bar: string }
> = {
  crecimiento: {
    label: "📈 Crecimiento",
    short: "Crecimiento",
    badge: "bg-sky-600/20 text-sky-300",
    dot: "bg-sky-400",
    bar: "bg-sky-500",
  },
  adoctrinamiento: {
    label: "🧲 Adoctrinamiento",
    short: "Adoctrinamiento",
    badge: "bg-violet-600/20 text-violet-300",
    dot: "bg-violet-400",
    bar: "bg-violet-500",
  },
  conversion: {
    label: "🎯 Conversión",
    short: "Conversión",
    badge: "bg-amber-600/20 text-amber-300",
    dot: "bg-amber-400",
    bar: "bg-amber-500",
  },
};

export type PilarMix = {
  counts: Record<Pilar, number>;
  total: number;
  sinPilar: number;
  /** Pilares sin ninguna pieza (hueco de estrategia). */
  ausentes: Pilar[];
  /** Pilar que acapara más del 70% de lo planificado, si lo hay. */
  dominante: Pilar | null;
};

/** Mezcla de pilares de un conjunto de piezas ya cargadas (sin tocar la BD). */
export function pilarMix(items: { pilar?: string | null }[]): PilarMix {
  const counts = { crecimiento: 0, adoctrinamiento: 0, conversion: 0 } as Record<Pilar, number>;
  let sinPilar = 0;

  for (const it of items) {
    const p = toPilar(it.pilar);
    if (p) counts[p]++;
    else sinPilar++;
  }

  const total = counts.crecimiento + counts.adoctrinamiento + counts.conversion;
  const ausentes = total > 0 ? PILARES.filter((p) => counts[p] === 0) : [];
  const dominante =
    total >= 3 ? PILARES.find((p) => counts[p] / total > 0.7) ?? null : null;

  return { counts, total, sinPilar, ausentes, dominante };
}
