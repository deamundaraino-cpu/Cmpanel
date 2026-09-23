import { chatJson } from "./llm";

// Verificación determinista de las reglas duras de una marca. El manual va en
// el prompt, pero los modelos se lo saltan: inventan normativa, citan artículos
// prohibidos o mezclan impuestos. Aquí se revisa el texto YA generado.
//
// Dos niveles:
// - crítico: error factual o de compliance. Si sobrevive a la reparación, la
//   pieza no se publica: queda bloqueada.
// - estilo: muletillas, listas largas, CTA múltiple. Se repara y, si sobrevive,
//   se marca para revisión.

export type RuleLevel = "critico" | "estilo";
export type BannedRule = { label: string; level: RuleLevel; explain?: string; test: (text: string) => boolean };
export type Violation = { label: string; level: RuleLevel; explain?: string };

const CRITICAL_ATTEMPTS = 2;
const STYLE_ATTEMPTS = 1;

/**
 * Formato de la lista, una regla por línea:
 *   [CRITICO] / [ESTILO]   cambian el nivel de las siguientes
 *   texto suelto           término prohibido (sin distinguir mayúsculas)
 *   /patrón/               expresión regular
 *   … | explicación        por qué está prohibido (se le pasa al modelo al reparar)
 */
export function parseBannedRules(raw: string | null | undefined): BannedRule[] {
  let level: RuleLevel = "estilo";
  const rules: BannedRule[] = [];

  for (const line of (raw || "").split("\n")) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;

    const header = l.match(/^\[(.+)\]$/);
    if (header) {
      const name = header[1].toLowerCase();
      level = name.startsWith("crit") ? "critico" : "estilo";
      continue;
    }

    // Una expresión regular puede contener "|", así que primero se intenta leer
    // como /patrón/flags y solo después se separa la explicación.
    const asRegex = l.match(/^\/(.+)\/([a-zA-Z]*)\s*(?:\|\s*(.*))?$/);
    if (asRegex) {
      const [, body, flags, explainText] = asRegex;
      try {
        const rx = new RegExp(body, flags.includes("i") ? flags : `${flags}i`);
        rules.push({
          label: `/${body}/${flags}`,
          level,
          explain: explainText?.trim() || undefined,
          test: (t) => rx.test(t),
        });
        continue;
      } catch {
        // Patrón inválido: se trata como texto literal.
      }
    }

    const [pattern, ...rest] = l.split("|");
    const explain = rest.join("|").trim() || undefined;
    const body = pattern.trim();
    if (!body) continue;
    const needle = body.toLowerCase();
    rules.push({ label: body, level, explain, test: (t) => t.toLowerCase().includes(needle) });
  }
  return rules;
}

export function findViolations(text: string, rules: BannedRule[]): Violation[] {
  return rules.filter((r) => r.test(text)).map(({ label, level, explain }) => ({ label, level, explain }));
}

/** Una sola infracción crítica impide publicar. */
export function isBlocking(violations: Violation[]): boolean {
  return violations.some((v) => v.level === "critico");
}

// ————— Chequeos estructurales (no dependen de la lista de la marca) —————

const CTA_VERBS = /\b(guarda|comenta|escribe|comparte|s[ií]gueme|sigue|manda|env[ií]a|agenda|descarga|reg[ií]strate)\b/gi;
const ORDINALS: Record<string, number> = {
  primera: 1, segunda: 2, tercera: 3, cuarta: 4, quinta: 5, sexta: 6, séptima: 7, septima: 7,
};
const NUMBER_WORDS: Record<string, number> = { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7 };

function textsOf(gen: unknown): string[] {
  const g = gen as { slides?: { titulo?: string; cuerpo?: string }[]; beats?: { texto?: string }[] };
  if (Array.isArray(g?.slides)) return g.slides.map((s) => `${s.titulo || ""} ${s.cuerpo || ""}`.trim());
  if (Array.isArray(g?.beats)) return g.beats.map((b) => b.texto || "");
  return [];
}

/**
 * Fallos de estructura que ninguna lista de términos detecta: prometer tres
 * señales y entregar cuatro, o cerrar con varios CTA a la vez.
 */
export function structuralViolations(gen: unknown): Violation[] {
  const blocks = textsOf(gen);
  if (!blocks.length) return [];
  const out: Violation[] = [];

  // Varias llamadas a la acción en un mismo bloque.
  for (const b of blocks) {
    const verbs = new Set((b.match(CTA_VERBS) || []).map((v) => v.toLowerCase()));
    if (verbs.size > 1) {
      out.push({
        label: "CTA múltiple",
        level: "estilo",
        explain: `Una pieza lleva UNA sola acción. Este bloque pide varias a la vez (${[...verbs].join(", ")}): deja solo la principal.`,
      });
      break;
    }
  }

  // El gancho anuncia N elementos y el cuerpo entrega otra cantidad.
  const hook = blocks[0] || "";
  const m = hook.match(/\b(\d+|dos|tres|cuatro|cinco|seis|siete)\b/i);
  const anunciado = m ? Number(m[1]) || NUMBER_WORDS[m[1].toLowerCase()] : 0;
  if (anunciado >= 2 && anunciado <= 7) {
    let maxOrdinal = 0;
    for (const b of blocks.slice(1)) {
      for (const [word, n] of Object.entries(ORDINALS)) {
        if (new RegExp(`\\b${word}\\b`, "i").test(b)) maxOrdinal = Math.max(maxOrdinal, n);
      }
    }
    if (maxOrdinal > anunciado) {
      out.push({
        label: `Anuncia ${anunciado} y entrega ${maxOrdinal}`,
        level: "estilo",
        explain: `El gancho promete ${anunciado} elementos pero el cuerpo desarrolla ${maxOrdinal}. Ajusta el gancho o elimina los sobrantes: el número prometido se cumple.`,
      });
    }
  }

  return out;
}

function repairPrompt(gen: unknown, violations: Violation[]): string {
  const lista = violations
    .map((v) => `- ${v.label}${v.explain ? `\n  Por qué: ${v.explain}` : ""}`)
    .join("\n");
  return `Este JSON incumple reglas inviolables de la marca:\n${JSON.stringify(
    gen
  )}\n\nIncumplimientos y su motivo (corrígelos TODOS, incluidas sus variantes; no basta con cambiar la palabra si la idea sigue prohibida):\n${lista}\n\nDevuelve EXACTAMENTE la misma estructura JSON, con los mismos campos y la misma cantidad de elementos, cambiando solo lo necesario para cumplir. No añadas comentarios.`;
}

/**
 * Revisa la pieza generada y, si incumple, pide reescrituras explicando la
 * regla violada (el modelo no sabe POR QUÉ algo está prohibido). Los críticos
 * tienen dos intentos; el estilo, uno. Devuelve lo mejor que se consiguió.
 */
export async function enforceBrandRules<T>(
  gen: T,
  rules: BannedRule[],
  system: string
): Promise<{ gen: T; violations: Violation[]; blocked: boolean }> {
  let best = gen;
  let violations = [...findViolations(JSON.stringify(gen), rules), ...structuralViolations(gen)];
  if (!violations.length) return { gen, violations, blocked: false };

  const attempts = isBlocking(violations) ? CRITICAL_ATTEMPTS : STYLE_ATTEMPTS;
  for (let i = 0; i < attempts && violations.length; i++) {
    try {
      const fixed = await chatJson<T>(system, repairPrompt(best, violations));
      const left = [...findViolations(JSON.stringify(fixed), rules), ...structuralViolations(fixed)];
      // Solo se acepta la reescritura si mejora; si empeora, se conserva la anterior.
      if (left.length < violations.length) {
        best = fixed;
        violations = left;
      }
    } catch {
      break; // Sin reparación posible: se entrega lo que hay con su aviso.
    }
  }

  return { gen: best, violations, blocked: isBlocking(violations) };
}

/** Nota para el usuario cuando algo sigue incumpliendo tras la reescritura. */
export function violationsNote(violations: Violation[]): string | null {
  if (!violations.length) return null;
  const criticos = violations.filter((v) => v.level === "critico").map((v) => v.label);
  const estilo = violations.filter((v) => v.level === "estilo").map((v) => v.label);
  const partes = [
    criticos.length ? `⛔ Bloqueada por: ${criticos.join(", ")}` : "",
    estilo.length ? `⚠️ Revisar a mano: ${estilo.join(", ")}` : "",
  ].filter(Boolean);
  return partes.join(" · ");
}
