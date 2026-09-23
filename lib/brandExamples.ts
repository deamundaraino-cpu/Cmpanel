import { getSql, ProposalRow } from "./db";

// Biblioteca de ejemplos aprobados: el modelo no aprende entre llamadas, así
// que lo más parecido a entrenarlo es mostrarle piezas que el cliente ya validó.
// Se toman de las propuestas aprobadas y se inyectan compactas (solo titulares
// y ganchos) para no inflar el prompt.

const MAX_EXAMPLES = 3;
const MAX_BLOCK_CHARS = 1200;

type Slide = { titulo?: string; cuerpo?: string };
type Beat = { seccion?: string; texto?: string };

function oneLine(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function carouselExample(row: ProposalRow): string | null {
  try {
    const slides = JSON.parse(row.slides || "[]") as Slide[];
    const titles = slides.map((s) => s.titulo).filter((t): t is string => !!t);
    if (!titles.length) return null;
    const [portada, ...resto] = titles;
    const cuerpo = slides[0]?.cuerpo ? ` (cuerpo: ${oneLine(slides[0].cuerpo, 110)})` : "";
    return `- Portada: ${oneLine(portada, 90)}${cuerpo}\n  Slides: ${resto.slice(0, 3).map((t) => oneLine(t, 60)).join(" · ")}`;
  } catch {
    return null;
  }
}

function scriptExample(row: ProposalRow): string | null {
  try {
    const beats = JSON.parse(row.slides || "[]") as Beat[];
    const hook = beats[0]?.texto;
    if (!hook) return null;
    const cierre = beats[beats.length - 1]?.texto;
    return `- Gancho: ${oneLine(hook, 180)}${cierre && beats.length > 1 ? `\n  Cierre: ${oneLine(cierre, 140)}` : ""}`;
  } catch {
    return null;
  }
}

/**
 * Bloque de ejemplos para inyectar en el prompt. Vacío si la marca aún no ha
 * aprobado piezas de ese formato: en ese caso no hay nada que imitar.
 */
export async function buildExamplesBlock(clientId: number, formato: "carrusel" | "guion_video"): Promise<string> {
  const sql = getSql();
  const rows = await sql<ProposalRow[]>`
    SELECT * FROM proposals
    WHERE client_id = ${clientId} AND status = 'aprobada' AND formato = ${formato}
    ORDER BY quality DESC NULLS LAST, id DESC
    LIMIT ${MAX_EXAMPLES}
  `;
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

  return `\n\nPIEZAS YA APROBADAS POR ESTA MARCA (el cliente las validó: imita su registro, su longitud y dónde coloca la frase clave; nunca repitas su tema ni copies sus frases):\n${block.trim()}`;
}
