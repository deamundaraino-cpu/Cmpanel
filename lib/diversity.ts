import { stripEmphasis } from "./emphasis";
import type { Violation } from "./brandRules";

// Memoria de variedad entre piezas de una misma marca.
//
// El modelo no recuerda nada entre llamadas: sin esto, cuatro guiones seguidos
// de GOEASY abrieron con "Tienes siete propiedades" y tres cerraron con la
// misma pregunta cambiando solo la cola. Aquí se detecta de forma determinista
// y se le pasa al reparador de lib/brandRules.ts, que ya sabe pedir una
// reescritura explicando el motivo.
//
// Nivel "estilo" a propósito: la repetición se corrige y se avisa, nunca
// bloquea la publicación. Eso queda para los errores de norma.

/** Ventana de apertura que se compara: el gancho se juega en la primera frase. */
const OPENING_WORDS = 12;
/** Un cierre es "el mismo con otra cola" a partir de aquí. */
const CLOSING_MIN = 0.5;
/**
 * Por encima de esto se considera repetición literal, que normalmente es el CTA
 * fijo de la marca ("Reserva tu Asesoría de Arquitectura, link en bio") y es
 * deliberado. Lo que delata el tic del modelo es la variación, no la copia.
 */
const CLOSING_MAX = 0.95;
/**
 * Por debajo de esto el cierre es demasiado corto para compararlo: con tres o
 * cuatro trigramas, el CTA fijo de la marca ("Agenda tu Asesoría de
 * Arquitectura") sale parecido a cualquier variante suya y se marcaría sin
 * motivo. Los cierres que delatan el tic del modelo son frases largas.
 */
const CLOSING_MIN_WORDS = 6;

const STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a", "y", "o", "u", "e",
  "que", "en", "con", "por", "para", "su", "sus", "tu", "tus", "mi", "mis", "se", "lo", "le", "les",
  "es", "son", "fue", "era", "como", "mas", "ya", "no", "si", "ni", "pero", "esa", "ese", "esta",
  "este", "esto", "eso", "hay", "ha", "han", "te", "me", "sin", "sobre", "cuando",
]);

/** Texto comparable: sin énfasis, sin tildes, sin puntuación. */
export function normalize(texto: string): string {
  return stripEmphasis(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const words = (texto: string): string[] => normalize(texto).split(" ").filter(Boolean);
const contentWords = (texto: string): string[] => words(texto).filter((w) => w.length > 1 && !STOPWORDS.has(w));

/**
 * Huella de apertura: las tres primeras palabras con carga semántica. Dos
 * ganchos con la misma huella empiezan igual aunque cambien el resto.
 */
export function openerKey(texto: string): string {
  return contentWords(texto).slice(0, 3).join(" ");
}

/** Trigramas de palabra de la ventana inicial, para detectar la frase repetida aunque no abra la pieza. */
function openingShingles(texto: string): Set<string> {
  const ws = contentWords(texto).slice(0, OPENING_WORDS);
  const out = new Set<string>();
  for (let i = 0; i + 2 < ws.length; i++) out.add(`${ws[i]} ${ws[i + 1]} ${ws[i + 2]}`);
  return out;
}

function trigrams(texto: string): Set<string> {
  const ws = words(texto);
  const out = new Set<string>();
  for (let i = 0; i + 2 < ws.length; i++) out.add(`${ws[i]} ${ws[i + 1]} ${ws[i + 2]}`);
  return out;
}

/**
 * Coeficiente de solapamiento (compartidos / el más corto). Frente a Jaccard,
 * detecta que una frase es la otra con una cola distinta, que es justo el
 * patrón que se busca.
 */
export function similarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return shared / Math.min(A.size, B.size);
}

export type PreviousPiece = {
  gancho: string | null;
  cierre: string | null;
  /** Familia de gancho con la que se escribió (lib/angles.ts), si se registró. */
  familia?: string | null;
};

/** Apertura y cierre de una pieza guardada, en la forma que usa `proposals.slides`. */
export function piecePoles(slides: string | null, formato: string | null): PreviousPiece {
  try {
    const items = JSON.parse(slides || "[]") as { titulo?: string; texto?: string }[];
    if (!items.length) return { gancho: null, cierre: null };
    const campo = (i: { titulo?: string; texto?: string }) => (formato === "guion_video" ? i.texto : i.titulo) || null;
    return { gancho: campo(items[0]), cierre: items.length > 1 ? campo(items[items.length - 1]) : null };
  } catch {
    return { gancho: null, cierre: null };
  }
}

function polesOfGen(gen: unknown): PreviousPiece {
  const g = gen as { slides?: { titulo?: string }[]; beats?: { texto?: string }[] };
  const items = Array.isArray(g?.beats) ? g.beats.map((b) => b.texto || "") : Array.isArray(g?.slides) ? g.slides.map((s) => s.titulo || "") : [];
  if (!items.length) return { gancho: null, cierre: null };
  return { gancho: items[0] || null, cierre: items.length > 1 ? items[items.length - 1] || null : null };
}

/**
 * Compara la pieza recién generada con las últimas de la marca. Devuelve
 * infracciones de estilo con el texto concreto que colisiona, para que el
 * reparador sepa qué tiene que esquivar.
 */
export function repetitionViolations(gen: unknown, previas: PreviousPiece[]): Violation[] {
  const { gancho, cierre } = polesOfGen(gen);
  const out: Violation[] = [];

  if (gancho) {
    const clave = openerKey(gancho);
    const shingles = openingShingles(gancho);
    for (const p of previas) {
      if (!p.gancho) continue;
      const mismaClave = clave && clave === openerKey(p.gancho);
      let frase = "";
      if (!mismaClave) {
        for (const s of openingShingles(p.gancho)) if (shingles.has(s)) { frase = s; break; }
      }
      if (mismaClave || frase) {
        out.push({
          label: "Gancho repetido",
          level: "estilo",
          explain: `Esta marca ya abrió una pieza con "${p.gancho.slice(0, 90)}". Reescribe el gancho entero desde otro ángulo: no basta con cambiar el final de la frase, tiene que empezar por otro sitio y con otras palabras.`,
        });
        break;
      }
    }
  }

  if (cierre) {
    const suficiente = words(cierre).length >= CLOSING_MIN_WORDS;
    for (const p of previas) {
      if (!p.cierre || !suficiente || words(p.cierre).length < CLOSING_MIN_WORDS) continue;
      const s = similarity(cierre, p.cierre);
      if (s >= CLOSING_MIN && s < CLOSING_MAX) {
        out.push({
          label: "Cierre repetido",
          level: "estilo",
          explain: `El cierre es una variación del que ya usó esta marca: "${p.cierre.slice(0, 90)}". Cambiar la cola de la misma frase no cuenta: escribe un cierre distinto.`,
        });
        break;
      }
    }
  }

  return out;
}

/** Bloque para el prompt con lo ya usado, en negativo. */
export function buildAvoidBlock(previas: PreviousPiece[]): string {
  const ganchos = [...new Set(previas.map((p) => p.gancho).filter((g): g is string => !!g))].slice(0, 6);
  const cierres = [...new Set(previas.map((p) => p.cierre).filter((c): c is string => !!c))].slice(0, 6);
  if (!ganchos.length && !cierres.length) return "";

  const linea = (t: string) => `- ${stripEmphasis(t).replace(/\s+/g, " ").trim().slice(0, 120)}`;
  const partes = [
    ganchos.length ? `Aperturas ya usadas:\n${ganchos.map(linea).join("\n")}` : "",
    cierres.length ? `Cierres ya usados:\n${cierres.map(linea).join("\n")}` : "",
  ].filter(Boolean);

  return `\n\nYA PUBLICADO POR ESTA MARCA — prohibido repetirlo y prohibido repetir su forma. Si tu primera frase empieza con las mismas palabras que una de estas, o tu cierre es una de estas con otra cola, no sirve: el patrón reciclado hunde el alcance.\n${partes.join("\n\n")}`;
}

/** Cuántas piezas atrás mira la memoria de variedad. */
const RECENT_LIMIT = 8;

/**
 * Últimas piezas de la marca en ese formato, con su apertura y su cierre.
 * Mira todos los estados: una pieza rechazada también quemó su gancho.
 */
export async function recentPieces(
  clientId: number,
  formato: "carrusel" | "guion_video",
  excludeId?: number
): Promise<PreviousPiece[]> {
  const { getSql } = await import("./db");
  const sql = getSql();
  const rows = await sql<{ slides: string | null; formato: string | null; hook_family: string | null }[]>`
    SELECT slides, formato, hook_family FROM proposals
    WHERE client_id = ${clientId} AND formato = ${formato}
      AND (${excludeId ?? null}::bigint IS NULL OR id <> ${excludeId ?? null}::bigint)
    ORDER BY id DESC
    LIMIT ${RECENT_LIMIT}
  `;
  return rows
    .map((r) => ({ ...piecePoles(r.slides, r.formato), familia: r.hook_family }))
    .filter((p) => p.gancho || p.cierre);
}
