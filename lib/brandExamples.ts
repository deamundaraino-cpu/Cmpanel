import { getSql, ProposalRow } from "./db";

// Biblioteca de ejemplos aprobados: el modelo no aprende entre llamadas, así
// que lo más parecido a entrenarlo es mostrarle piezas que el cliente ya validó.
//
// Cuidado con QUÉ se le muestra. Este bloque exponía el gancho y el cierre de
// las 3 últimas aprobadas y pedía imitar "dónde coloca la frase clave": el
// resultado fue que cuatro guiones seguidos abrieron igual. La apertura y el
// cierre son justo lo que NO debe repetirse; el registro de marca vive en el
// medio de la pieza. Así que se muestra el medio, y las aperturas gastadas se
// usan en el bloque de evitación (lib/diversity.ts).

const MAX_EXAMPLES = 3;
const MAX_BLOCK_CHARS = 1200;

type Slide = { titulo?: string; cuerpo?: string };
type Beat = { seccion?: string; texto?: string };

function oneLine(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Un elemento del cuerpo, nunca el primero ni el último. Devuelve null si la
 * pieza solo tiene apertura y cierre: no hay nada que enseñar sin enseñar la
 * fórmula.
 */
function middleOf<T>(items: T[]): T | null {
  if (items.length < 3) return null;
  return items[Math.floor(items.length / 2)] ?? null;
}

function carouselExample(row: ProposalRow): string | null {
  try {
    const slides = JSON.parse(row.slides || "[]") as Slide[];
    const slide = middleOf(slides);
    const titulo = slide?.titulo?.trim();
    if (!titulo) return null;
    const cuerpo = slide?.cuerpo ? `\n  ${oneLine(slide.cuerpo, 150)}` : "";
    return `- ${oneLine(titulo, 80)}${cuerpo}`;
  } catch {
    return null;
  }
}

function scriptExample(row: ProposalRow): string | null {
  try {
    const beats = JSON.parse(row.slides || "[]") as Beat[];
    const beat = middleOf(beats);
    const texto = beat?.texto?.trim();
    if (!texto) return null;
    return `- ${oneLine(texto, 220)}`;
  } catch {
    return null;
  }
}

/** Cuántas piezas hay marcadas como ejemplo, por formato (para mostrarlo en la UI). */
export async function countExemplars(clientId: number): Promise<Record<string, number>> {
  const sql = getSql();
  const rows = await sql<{ formato: string | null; n: number }[]>`
    SELECT formato, count(*)::int AS n FROM proposals
    WHERE client_id = ${clientId} AND is_exemplar = TRUE AND status = 'aprobada'
    GROUP BY formato
  `;
  return Object.fromEntries(rows.map((r) => [r.formato || "otro", r.n]));
}

/** Composición del bloque a partir de las filas ya leídas (pura, testeable). */
export function formatExamplesBlock(rows: ProposalRow[], formato: "carrusel" | "guion_video"): string {
  const examples = rows
    .map((r) => (formato === "carrusel" ? carouselExample(r) : scriptExample(r)))
    .filter((e): e is string => !!e);
  if (!examples.length) return "";

  let block = "";
  for (const e of examples) {
    if (block.length + e.length > MAX_BLOCK_CHARS) break;
    block += `${e}\n`;
  }
  if (!block) return "";

  return `\n\nREFERENCIA DE VOZ — fragmentos del cuerpo de piezas que este cliente ya validó. De aquí se copia SOLO el registro: nivel de formalidad, longitud de frase, cuánto dato entra por frase y qué da por sabido de su audiencia. NUNCA se copia la apertura, el cierre, la estructura de la frase ni el ángulo: eso ya se usó y repetirlo hunde el alcance. Si tu primera frase se parece a alguna de estas, reescríbela.\n${block.trim()}`;
}

/**
 * Bloque de ejemplos para inyectar en el prompt. Vacío si la marca aún no ha
 * aprobado piezas de ese formato: en ese caso no hay nada que imitar.
 */
export async function buildExamplesBlock(clientId: number, formato: "carrusel" | "guion_video"): Promise<string> {
  const sql = getSql();
  // Manda lo que el editor marcó a mano; la autoevaluación de la IA no decide
  // qué imita la IA. A igualdad, las más recientes.
  const rows = await sql<ProposalRow[]>`
    SELECT * FROM proposals
    WHERE client_id = ${clientId} AND status = 'aprobada' AND formato = ${formato}
    ORDER BY is_exemplar DESC, id DESC
    LIMIT ${MAX_EXAMPLES}
  `;
  return formatExamplesBlock(rows, formato);
}
