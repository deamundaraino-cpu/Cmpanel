// Referentes manuales: ratio sobre la media, parseo del análisis y contexto
// para la búsqueda de ideas.
//
//   npx tsx scripts/test-referentes.mjs

import { outlierRatios, parseAnalisis, buildReferentesContext } from "../lib/referentes.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

const pieza = (id, referente_id, vistas, analisis = null) => ({
  id, referente_id, vistas, texto: "x", formato: null, analisis, handle: referente_id === 1 ? "@ana" : "beto",
});

// —— Ratios ——
const r = outlierRatios([pieza(1, 1, 1000), pieza(2, 1, 2000), pieza(3, 1, 6000), pieza(4, 2, 500), pieza(5, 2, 900)]);
ok(r.get(3) === 3, "×3 sobre la mediana de su referente", String(r.get(3)));
ok(r.get(2) === 1, "la mediana vale ×1");
ok(!r.has(4) && !r.has(5), "con menos de 3 piezas con vistas no hay ratio");
ok(!outlierRatios([pieza(1, 1, null), pieza(2, 1, 0), pieza(3, 1, 10)]).size, "vistas nulas o cero no cuentan");

// —— Parseo ——
const a = parseAnalisis({
  gancho: "  Cifra chocante  ",
  formato: "talking head",
  estructura: [{ nombre: "Hook", guia: "abre" }, { guia: "sin nombre" }, "basura"],
  patron_replicable: "usa una cifra propia",
  por_que_funciona: "rompe expectativa",
});
ok(a?.gancho === "Cifra chocante", "recorta espacios");
ok(a?.estructura.length === 1, "descarta bloques sin nombre");
ok(parseAnalisis({}) === null, "análisis vacío = null");
ok(parseAnalisis("texto") === null, "no-objeto = null");

// —— Contexto ——
const an = (g) => JSON.stringify({ gancho: g, patron_replicable: "p", estructura: [] });
const ctx = buildReferentesContext([
  pieza(1, 1, 1000, an("normal")),
  pieza(2, 1, 2000, null),
  pieza(3, 1, 9000, an("viral")),
]);
ok(ctx.indexOf("viral") < ctx.indexOf("normal"), "los outliers van primero");
ok(ctx.includes("@ana") && !ctx.includes("@@ana"), "handle con una sola @");
ok(ctx.includes("×4.5"), "incluye el ratio", ctx.split("\n")[0]);
ok(buildReferentesContext([pieza(1, 1, 10)]) === "", "sin análisis no hay contexto");

if (fallos) {
  console.log(`\n${fallos} fallo(s)`);
  process.exit(1);
}
console.log("\nTodo OK");
