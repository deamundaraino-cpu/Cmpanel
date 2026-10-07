// Contexto de partida de una pieza generada desde una idea.
//
// Antes viajaba `tema + " — " + angulo` cortado a 500 caracteres: la razón y la
// evidencia —los dos campos que hacen distinta a una idea de otra— se perdían
// antes de llegar al modelo. Con la misma materia prima para cuatro temas, el
// modelo converge; es la mitad del problema de repetición.

export type IdeaSource = {
  tema: string;
  /** Afirmación concreta y discutible (búsqueda v2; las ideas viejas no la tienen). */
  tesis?: string | null;
  angulo?: string | null;
  razon?: string | null;
  /** JSON {tipo, detalle}: el dato real de la cuenta en el que se apoya la idea. */
  evidencia?: string | null;
  /** JSON string[]: aperturas propuestas al generar la idea. */
  ganchos?: string | null;
};

const TOPES = { tema: 300, tesis: 400, angulo: 400, razon: 400, evidencia: 250, gancho: 200 } as const;

const recorta = (texto: string, max: number): string => {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
};

function describeEvidencia(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const ev = JSON.parse(raw) as { tipo?: string; detalle?: string };
    const detalle = (ev?.detalle || "").trim();
    if (!detalle) return "";
    return `${ev.tipo ? `(${ev.tipo}) ` : ""}${recorta(detalle, TOPES.evidencia)}`;
  } catch {
    return recorta(String(raw), TOPES.evidencia);
  }
}

function parseGanchos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const g = JSON.parse(raw);
    return Array.isArray(g) ? g.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 3) : [];
  } catch {
    return [];
  }
}

/**
 * Bloque etiquetado con lo que de verdad distingue a esta idea. Cada campo con
 * su propio tope, en vez de un corte ciego sobre el concatenado.
 */
export function buildIdeaContext(idea: IdeaSource): string {
  const partes: string[] = [`Tema: ${recorta(idea.tema || "", TOPES.tema)}`];

  const tesis = (idea.tesis || "").trim();
  if (tesis) partes.push(`Tesis que defiende la pieza: ${recorta(tesis, TOPES.tesis)}`);

  const angulo = (idea.angulo || "").trim();
  if (angulo) partes.push(`Ángulo concreto: ${recorta(angulo, TOPES.angulo)}`);

  const razon = (idea.razon || "").trim();
  if (razon) partes.push(`Por qué ahora: ${recorta(razon, TOPES.razon)}`);

  const evidencia = describeEvidencia(idea.evidencia);
  if (evidencia) partes.push(`Evidencia real de la cuenta: ${evidencia}`);

  const ganchos = parseGanchos(idea.ganchos);
  if (ganchos.length) {
    partes.push(
      `Ganchos candidatos (orientativos, puedes mejorarlos):\n${ganchos.map((g) => `- ${recorta(g, TOPES.gancho)}`).join("\n")}`
    );
  }

  const cierre =
    tesis || angulo || evidencia
      ? "\n\nLa tesis, el ángulo y la evidencia son la materia prima de ESTA pieza: si el guion podría escribirse igual sin ellos, no sirve."
      : "";

  return `Punto de partida de esta pieza:\n${partes.join("\n")}${cierre}`;
}
