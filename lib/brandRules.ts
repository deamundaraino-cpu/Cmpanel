import { chatJson } from "./llm";

// Verificación determinista de las reglas duras de una marca. El manual de
// redacción va en el prompt, pero los modelos se lo saltan: inventan nombres de
// producto, se van al voseo o citan normativa no autorizada. Aquí se revisa el
// texto ya generado y, si incumple, se pide una reescritura puntual.

export type BannedRule = { label: string; test: (text: string) => boolean };

/**
 * Una regla por línea. Texto suelto = término prohibido (sin distinguir
 * mayúsculas); `/patrón/` = expresión regular para casos finos (voseo, cifras).
 */
export function parseBannedRules(raw: string | null | undefined): BannedRule[] {
  return (raw || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((line) => {
      const re = line.match(/^\/(.+)\/([a-z]*)$/);
      if (re) {
        try {
          const rx = new RegExp(re[1], re[2].includes("i") ? re[2] : `${re[2]}i`);
          return { label: line, test: (t: string) => rx.test(t) };
        } catch {
          // Patrón inválido: se trata como texto literal.
        }
      }
      const needle = line.toLowerCase();
      return { label: line, test: (t: string) => t.toLowerCase().includes(needle) };
    });
}

export function findViolations(text: string, rules: BannedRule[]): string[] {
  return rules.filter((r) => r.test(text)).map((r) => r.label);
}

/**
 * Revisa el JSON generado contra las reglas de la marca y, si las incumple,
 * pide UNA reescritura corrigiendo solo lo que falla. Devuelve lo que quede,
 * junto con las infracciones que sigan presentes para avisar al usuario.
 */
export async function enforceBrandRules<T>(
  gen: T,
  rules: BannedRule[],
  system: string
): Promise<{ gen: T; violations: string[] }> {
  if (!rules.length) return { gen, violations: [] };
  const violations = findViolations(JSON.stringify(gen), rules);
  if (!violations.length) return { gen, violations: [] };

  try {
    const fixed = await chatJson<T>(
      system,
      `Este JSON incumple reglas inviolables de la marca:\n${JSON.stringify(gen)}\n\nIncumplimientos detectados (elimínalos por completo, incluidas sus variantes):\n${violations
        .map((v) => `- ${v}`)
        .join("\n")}\n\nDevuelve EXACTAMENTE la misma estructura JSON, con los mismos campos y la misma cantidad de elementos, cambiando solo lo necesario para cumplir. No añadas comentarios.`
    );
    const left = findViolations(JSON.stringify(fixed), rules);
    return { gen: left.length < violations.length ? fixed : gen, violations: left };
  } catch {
    // Si la reescritura falla, se entrega lo generado con el aviso.
    return { gen, violations };
  }
}

/** Nota para el usuario cuando algo sigue incumpliendo tras la reescritura. */
export function violationsNote(violations: string[]): string | null {
  return violations.length ? `⚠️ Revisar a mano: ${violations.join(", ")}` : null;
}
