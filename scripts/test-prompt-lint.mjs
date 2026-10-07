// Las plantillas del sistema no pueden pedir lo que las marcas prohíben.
//
// La estructura base #1 traía en su guía `Ej: "eso no es lo más loco...",
// "y curiosamente..."` y la #4 `Anuncia que el último es el que nadie dice`:
// las tres frases están en la lista de prohibidos de GOEASY. El generador
// obedecía a la plantilla y después el filtro castigaba el resultado.
//
//   npx tsx scripts/test-prompt-lint.mjs

import { parseBannedRules, findViolations } from "../lib/brandRules.ts";
import { BASE_STRUCTURES } from "../lib/baseStructures.ts";
import { QUALITY_BAR, EDIT_NOTES_INSTRUCTION, COVER_TEXTS_INSTRUCTION } from "../lib/proposalGen.ts";
import fs from "node:fs";

let fallos = 0;
const ok = (cond, label, detalle = "") => {
  console.log(`${cond ? "PASA " : "FALLA"}  ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

// Copia de la lista real de GOEASY (client 5), solo la parte de estilo que
// afecta a las plantillas. La de compliance vive en test-brand-rules.mjs.
const LISTA_GOEASY = `
[ESTILO]
plusvalía | Glosario chileno: se dice "mayor valor".
alquiler | Glosario chileno: se dice "arriendo".
/\\b(cuarta|quinta|sexta) (señal|razón|error|clave)/i | Nada de listas de más de 3 elementos.
/(que|lo que) nadie (dice|cuenta|te dice)/i | Muletilla de reel viral prohibida por el tono sobrio de la marca.
eso no es lo más loco | Muletilla de reel viral prohibida.
lo más increíble | Muletilla de reel viral prohibida.
el secreto que | Muletilla de reel viral prohibida.
y curiosamente | Muletilla de reel viral prohibida.
sin sorpresas | Muletilla vacía.
checklist | Prohibido ofrecer recursos gratuitos.
guía gratuita | Prohibido ofrecer recursos gratuitos.
`;

const reglas = parseBannedRules(LISTA_GOEASY);
ok(reglas.length === 11, "3a. la lista de prueba se parsea entera", `${reglas.length} reglas`);

// —— Las guías de las estructuras base ——
for (const s of BASE_STRUCTURES) {
  const texto = s.beats.map((b) => `${b.nombre}: ${b.guia}`).join("\n");
  const v = findViolations(texto, reglas);
  ok(v.length === 0, `3b. estructura base "${s.nombre}" no contradice a la marca`, v.map((x) => x.label).join(", "));
}

// —— Las instrucciones compartidas del generador ——
const constantes = [
  ["QUALITY_BAR", QUALITY_BAR],
  ["EDIT_NOTES_INSTRUCTION", EDIT_NOTES_INSTRUCTION],
  ["COVER_TEXTS_INSTRUCTION", COVER_TEXTS_INSTRUCTION],
];
for (const [nombre, texto] of constantes) {
  const v = findViolations(texto, reglas);
  ok(v.length === 0, `3c. ${nombre} no contradice a la marca`, v.map((x) => x.label).join(", "));
}

// —— El seed de schema.sql tiene que ir a la par del módulo ——
const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const seed = schema.slice(schema.indexOf("Seed de estructuras"));
for (const frase of ["eso no es lo más loco", "y curiosamente", "que nadie dice"]) {
  ok(!seed.includes(frase), `3d. el seed de schema.sql no siembra "${frase}"`);
}

console.log(fallos ? `\n${fallos} test(s) fallando` : "\nTodos los tests pasan");
process.exit(fallos ? 1 : 0);
