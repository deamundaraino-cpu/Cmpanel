// La galería de estructuras tiene que ser coherente: cada ficha apunta a
// formatos de grabación y familias de gancho que existen, cada pilar tiene
// opciones y ninguna estructura se sale de los límites del generador.
//
//   npx tsx scripts/test-structure-gallery.mjs

import { BASE_STRUCTURES } from "../lib/baseStructures.ts";
import { EXECUTION_FORMATS, executionContext } from "../lib/executionFormats.ts";
import { HOOK_FAMILIES } from "../lib/angles.ts";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

const formatos = new Set(EXECUTION_FORMATS.map((f) => f.id));
const familias = new Set(HOOK_FAMILIES.map((f) => f.id));

ok(new Set(BASE_STRUCTURES.map((s) => s.nombre)).size === BASE_STRUCTURES.length, "nombres de estructura únicos");
ok(formatos.size === EXECUTION_FORMATS.length, "ids de formato únicos");

for (const s of BASE_STRUCTURES) {
  const malosF = s.ficha.formatos.filter((id) => !formatos.has(id));
  const malasG = s.ficha.familias.filter((id) => !familias.has(id));
  ok(!malosF.length && !malasG.length, `"${s.nombre}" apunta a formatos y ganchos existentes`, [...malosF, ...malasG].join(", "));
  ok(s.beats.length >= 3 && s.beats.length <= 7, `"${s.nombre}" tiene entre 3 y 7 bloques`, String(s.beats.length));
  ok(s.ficha.cuandoNo.length > 20 && s.ficha.fuentes.length > 0, `"${s.nombre}" justifica cuándo no usarla y cita fuente`);
}

for (const pilar of ["crecimiento", "adoctrinamiento", "conversion"]) {
  const n = BASE_STRUCTURES.filter((s) => s.pilar === pilar).length;
  ok(n >= 4, `el pilar ${pilar} tiene al menos 4 estructuras`, String(n));
  const f = EXECUTION_FORMATS.filter((x) => x.pilares.includes(pilar)).length;
  ok(f >= 4, `el pilar ${pilar} tiene al menos 4 formatos de grabación`, String(f));
}

// Cada formato usado por alguna estructura, y el bloque para el prompt.
const usados = new Set(BASE_STRUCTURES.flatMap((s) => s.ficha.formatos));
const huerfanos = EXECUTION_FORMATS.filter((f) => !usados.has(f.id)).map((f) => f.id);
ok(huerfanos.length <= 6, "casi todos los formatos se recomiendan en alguna estructura", huerfanos.join(", "));
ok(executionContext("pizarra").includes("FORMATO DE GRABACIÓN"), "el formato entra al prompt");
ok(executionContext("no-existe") === "" && executionContext(null) === "", "formato desconocido no añade nada");

if (fallos) {
  console.log(`\n${fallos} fallo(s)`);
  process.exit(1);
}
console.log("\nTodo OK");
