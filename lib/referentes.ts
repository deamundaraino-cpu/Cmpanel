import { median } from "./stats";

/**
 * Referentes cargados a mano: lógica pura (sin BD ni IA) para el ratio de
 * rendimiento, el análisis de la IA y el contexto que se pasa a /api/research.
 */

export type ReferenteAnalisis = {
  gancho: string;
  formato: string;
  estructura: { nombre: string; guia: string }[];
  patron_replicable: string;
  por_que_funciona: string;
};

type PiezaLike = {
  id: number;
  referente_id: number;
  vistas: number | null;
  texto: string;
  formato: string | null;
  analisis: string | null;
};

/**
 * Vistas de cada pieza frente a la mediana de SU referente (×N). Solo se
 * calcula con al menos 3 piezas con vistas: con menos, la mediana no dice nada.
 */
export function outlierRatios(piezas: PiezaLike[]): Map<number, number> {
  const out = new Map<number, number>();
  const byRef = new Map<number, PiezaLike[]>();
  for (const p of piezas) {
    if (p.vistas == null || p.vistas <= 0) continue;
    byRef.set(p.referente_id, [...(byRef.get(p.referente_id) || []), p]);
  }
  for (const list of byRef.values()) {
    if (list.length < 3) continue;
    const med = median(list.map((p) => p.vistas as number));
    if (med <= 0) continue;
    for (const p of list) out.set(p.id, (p.vistas as number) / med);
  }
  return out;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Normaliza lo que devuelve la IA; null si no sirve para nada. */
export function parseAnalisis(raw: unknown): ReferenteAnalisis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const estructura = Array.isArray(r.estructura)
    ? r.estructura
        .map((b) => {
          const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
          return { nombre: str(o.nombre, 60), guia: str(o.guia, 400) };
        })
        .filter((b) => b.nombre)
        .slice(0, 8)
    : [];
  const a: ReferenteAnalisis = {
    gancho: str(r.gancho, 300),
    formato: str(r.formato, 80),
    estructura,
    patron_replicable: str(r.patron_replicable, 600),
    por_que_funciona: str(r.por_que_funciona, 600),
  };
  if (!a.gancho && !a.patron_replicable && !estructura.length) return null;
  return a;
}

export function readAnalisis(json: string | null): ReferenteAnalisis | null {
  if (!json) return null;
  try {
    return parseAnalisis(JSON.parse(json));
  } catch {
    return null;
  }
}

/**
 * Bloque de contexto para generar ideas desde referentes: primero las piezas
 * que más destacaron sobre la media de su cuenta, solo las ya analizadas.
 */
export function buildReferentesContext(
  piezas: (PiezaLike & { handle: string })[],
  limit = 15
): string {
  const ratios = outlierRatios(piezas);
  const analizadas = piezas
    .map((p) => ({ p, a: readAnalisis(p.analisis), r: ratios.get(p.id) ?? null }))
    .filter((x): x is { p: PiezaLike & { handle: string }; a: ReferenteAnalisis; r: number | null } => x.a !== null)
    .sort((x, y) => (y.r ?? 0) - (x.r ?? 0))
    .slice(0, limit);
  if (!analizadas.length) return "";
  return analizadas
    .map(({ p, a, r }, i) => {
      const lineas = [
        `${i + 1}. @${p.handle.replace(/^@/, "")}${r ? ` — ×${r.toFixed(1)} sobre su media` : ""}${a.formato ? ` — formato: ${a.formato}` : ""}`,
        a.gancho && `   Gancho: ${a.gancho}`,
        a.patron_replicable && `   Patrón: ${a.patron_replicable}`,
        a.por_que_funciona && `   Por qué funciona: ${a.por_que_funciona}`,
      ];
      return lineas.filter(Boolean).join("\n");
    })
    .join("\n");
}

export const ANALISIS_SYSTEM = `Eres un estratega de contenido para Instagram. Analizas piezas de cuentas de referencia para extraer el PATRÓN reutilizable (gancho, estructura y formato), nunca el tema ni las frases. Escribes en español neutro, concreto y sin relleno.`;

export function buildAnalisisPrompt(pieza: { texto: string; formato: string | null; vistas: number | null; likes: number | null; comentarios: number | null }, handle: string, brief: string): string {
  const nums = [
    pieza.vistas != null && `${pieza.vistas} vistas`,
    pieza.likes != null && `${pieza.likes} likes`,
    pieza.comentarios != null && `${pieza.comentarios} comentarios`,
  ].filter(Boolean);
  return `Pieza de @${handle.replace(/^@/, "")}${pieza.formato ? ` (${pieza.formato})` : ""}${nums.length ? ` — ${nums.join(", ")}` : ""}:
"""
${pieza.texto.slice(0, 4000)}
"""

Marca para la que se adaptará el patrón (solo para orientar «patron_replicable», no para analizar):
${brief.slice(0, 1500)}

Devuelve un objeto JSON:
{"gancho": "la apertura de la pieza resumida y qué mecanismo usa (curiosidad, contradicción, cifra, promesa…)", "formato": "talking head, lista, storytelling, tutorial, comparación, carrusel educativo…", "estructura": [{"nombre": "nombre corto del bloque", "guia": "qué consigue ese bloque y cómo, sin frases de ejemplo"}], "patron_replicable": "cómo aplicar este mismo patrón a la marca con un tema propio, en 1-2 frases", "por_que_funciona": "la razón concreta por la que esta pieza retiene o se comparte, 1-2 frases"}`;
}
