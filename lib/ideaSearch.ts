// Piezas puras de la búsqueda de ideas (sin BD ni red), para poder testearlas.
//
// El diagnóstico que motivó esto: de 168 ideas se usaron 9. La IA no sabía qué
// había propuesto antes, así que volvía a los mismos 4 temas con otra
// redacción; y la "evidencia" justificaba el formato, no la idea.

import { normalize } from "./diversity";
import { PILARES, type Pilar } from "./pilares";

// ————— Etapas de consciencia del cliente ideal —————

export const ETAPAS = ["consciencia", "consideracion", "decision"] as const;
export type Etapa = (typeof ETAPAS)[number];

export function toEtapa(v: unknown): Etapa | null {
  return typeof v === "string" && (ETAPAS as readonly string[]).includes(v) ? (v as Etapa) : null;
}

export const ETAPA_META: Record<Etapa, { label: string; guia: string }> = {
  consciencia: {
    label: "Aún no ve el problema",
    guia: "CONSCIENCIA: no sabe que tiene el problema o lo atribuye a otra causa. La pieza le hace ver el problema real.",
  },
  consideracion: {
    label: "Busca solución",
    guia: "CONSIDERACIÓN: sabe que tiene el problema y compara caminos. La pieza explica el camino correcto y por qué los otros fallan.",
  },
  decision: {
    label: "Elige con quién",
    guia: "DECISIÓN: sabe qué necesita y decide con quién. La pieza muestra prueba, método propio y por qué tú.",
  },
};

// ————— Duplicados —————

const STOP = new Set(
  ("de la el en y a los las un una que por para con del al lo se tu tus su sus mi mis es son no si mas " +
    "como cuando porque por que muy sin sobre este esta esto ese esa hay o u ya te le les nos vs " +
    "cual cuales como donde realmente siempre nunca todo toda todos solo tienes tiene hace hacer")
    .split(" ")
);

/** Raíces de las palabras con carga: "presupuesto"/"presupuestos" → "pres". */
function stems(texto: string): Set<string> {
  const out = new Set<string>();
  for (const w of normalize(texto).split(" ")) {
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
    out.add(w.slice(0, 4));
  }
  return out;
}

/** Solapamiento de raíces (compartidas / el conjunto más corto). */
export function ideaSimilarity(a: string, b: string): number {
  const A = stems(a);
  const B = stems(b);
  if (A.size < 2 || B.size < 2) return 0;
  let shared = 0;
  for (const s of A) if (B.has(s)) shared++;
  if (shared < 3) return 0;
  return shared / Math.min(A.size, B.size);
}

/**
 * Red de seguridad léxica: solo atrapa la casi-idéntica (mismo título o casi).
 * Las paráfrasis ("el CPA sube" / "el CPA se dispara") las decide el juez de
 * la IA en /api/research. Con umbral bajo, en un nicho estrecho todo comparte
 * "escalar", "rentabilidad", "funnel"… y se descartaban 9 de 9 candidatas.
 */
export const DUP_THRESHOLD = 0.7;

/** Texto que identifica una idea para comparar: título + tesis. */
export const ideaKey = (i: { tema: string; tesis?: string | null }) => `${i.tema} ${i.tesis || ""}`;

/** La idea más parecida de `previas`, si supera el umbral. */
export function findDuplicate<T extends { tema: string; tesis?: string | null }>(
  idea: { tema: string; tesis?: string | null },
  previas: T[]
): T | null {
  const k = ideaKey(idea);
  let best: T | null = null;
  let bestScore = DUP_THRESHOLD;
  for (const p of previas) {
    const s = Math.max(ideaSimilarity(idea.tema, p.tema), ideaSimilarity(k, ideaKey(p)));
    if (s >= bestScore) {
      best = p;
      bestScore = s;
    }
  }
  return best;
}

// ————— Momento del año —————

const TEMPORADA: Record<number, string> = {
  0: "Enero: arranque de año, planificación anual, propósitos de facturación; CPM bajos tras las fiestas (buen momento para escalar tráfico frío).",
  1: "Febrero: primeros números del año, quien no arrancó en enero siente presión; CPM aún moderados.",
  2: "Marzo: cierre del primer trimestre, revisión de resultados Q1.",
  3: "Abril: inicio de Q2, Semana Santa en LATAM/España (baja la atención unos días).",
  4: "Mayo: mitad de Q2, momento de corregir antes del verano.",
  5: "Junio: cierre de semestre, balance de mitad de año.",
  6: "Julio: arranque del segundo semestre, vacaciones en parte de la audiencia.",
  7: "Agosto: mes lento en España, planificación del último cuatrimestre.",
  8: "Septiembre: vuelta al trabajo, 'nuevo inicio' del curso, planificación de Q4.",
  9: "Octubre: inicio de Q4; quien no prepara ya Black Friday llega tarde; los CPM empiezan a subir.",
  10: "Noviembre: Black Friday y Cyber Monday; CPM en máximos del año, el tráfico frío se encarece; ofertas y urgencia.",
  11: "Diciembre: cierre de año, balances y planificación del año siguiente; CPM altos hasta Navidad.",
};

export function seasonalContext(fecha: Date): string {
  return `MOMENTO DEL AÑO (${fecha.toISOString().slice(0, 10)}): ${TEMPORADA[fecha.getMonth()]}`;
}

// ————— Mapa de huecos (pilar × etapa) —————

export type CoverageCell = { pilar: Pilar; etapa: Etapa; usadas: number; propuestas: number };

export function coverageMatrix(
  rows: { pilar: string | null; etapa: string | null; usada: boolean }[]
): CoverageCell[] {
  const cells: CoverageCell[] = [];
  for (const pilar of PILARES)
    for (const etapa of ETAPAS) cells.push({ pilar, etapa, usadas: 0, propuestas: 0 });
  for (const r of rows) {
    const c = cells.find((x) => x.pilar === r.pilar && x.etapa === r.etapa);
    if (!c) continue;
    c.propuestas++;
    if (r.usada) c.usadas++;
  }
  return cells;
}

/** Las celdas menos trabajadas primero (lo usado pesa más que lo propuesto). */
export function gaps(cells: CoverageCell[], n = 3): CoverageCell[] {
  return [...cells].sort((a, b) => a.usadas - b.usadas || a.propuestas - b.propuestas).slice(0, n);
}

export function describeCoverage(cells: CoverageCell[]): string {
  const huecos = gaps(cells);
  return (
    "COBERTURA ACTUAL (pilar × etapa del cliente: ideas usadas / propuestas):\n" +
    cells.map((c) => `- ${c.pilar} · ${c.etapa}: ${c.usadas} / ${c.propuestas}`).join("\n") +
    `\nHUECOS (lo menos trabajado): ${huecos.map((c) => `${c.pilar} · ${c.etapa}`).join(", ")}`
  );
}
