// Duplicados de ideas con títulos reales de la base (cliente 1, oct-2026):
// la IA repetía la misma tesis con otra redacción.
//
//   npx tsx scripts/test-idea-search.mjs

import { ideaSimilarity, findDuplicate, coverageMatrix, gaps, seasonalContext, DUP_THRESHOLD } from "../lib/ideaSearch.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

// El filtro léxico solo debe atrapar lo casi idéntico; las paráfrasis van al juez de la IA.
const dups = [
  ["Reembolsos ocultando rentabilidad", "Reembolsos ocultando rentabilidad"],
  ["La mentira de la escalera de valor tradicional (y por qué te frena)", "La mentira de la escalera de valor tradicional"],
  ["Infoproductos: El Negocio del Futuro", "Infoproductos: La Oportunidad de Negocio del Futuro"],
];
for (const [a, b] of dups) {
  const s = ideaSimilarity(a, b);
  ok(s >= DUP_THRESHOLD, "casi idéntica detectada", `${s.toFixed(2)} · ${a.slice(0, 40)}…`);
}

// Mismo nicho, tesis distinta: antes se descartaban por compartir 2 palabras del nicho.
const distintas = [
  ["Las 3 apps que realmente ahorran horas de edición (sin ser Photoshop)", "Cuando subir el presupuesto hace que el CPA suba"],
  ["Los 4 números que reviso cada semana para saber si mi funnel está sano", "Plantilla gratuita: hoja de diagnóstico de cuellos de botella para infoproductos"],
  ["Cómo pasé de 1.011 USD/mes a 10.842 USD/mes en 17 meses sin lanzamientos", "Tres señales de que tu dependencia de lanzamientos está limitando tu crecimiento"],
  ["Contratar un setter antes de tiempo te hunde el negocio", "Crear más contenido no te va a salvar de estar estancado en tu negocio"],
  ["Por qué duplicar el presupuesto en Meta Ads suele romper la rentabilidad", "Reembolsos ocultando rentabilidad en Meta Ads"],
];
for (const [a, b] of distintas) {
  const s = ideaSimilarity(a, b);
  ok(s < DUP_THRESHOLD, "distintas no se confunden", `${s.toFixed(2)} · ${a.slice(0, 40)}…`);
}

ok(
  findDuplicate({ tema: "Por qué subir el presupuesto hace que el CPA suba" }, [{ tema: "Cuando subir el presupuesto hace que el CPA suba" }]) !== null,
  "findDuplicate encuentra la previa"
);

const cells = coverageMatrix([
  { pilar: "crecimiento", etapa: "consciencia", usada: true },
  { pilar: "crecimiento", etapa: "consciencia", usada: false },
  { pilar: "conversion", etapa: "decision", usada: false },
]);
ok(cells.length === 9, "matriz 3×3");
ok(gaps(cells, 9).at(-1).etapa === "consciencia", "lo usado queda al final de los huecos");
ok(seasonalContext(new Date("2026-11-10")).includes("Black Friday"), "temporada de noviembre");

if (fallos) {
  console.log(`\n${fallos} fallo(s)`);
  process.exit(1);
}
console.log("\nTodo OK");
